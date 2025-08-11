import {Ability, GcdAbility, OgcdAbility, Buff, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    AbilityUseResult,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {CharacterGearSet} from "@xivgear/core/gear";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {DrgGaugeManager} from "./drg_gauge";
import {
    DrgAbility, DrgGcdAbility, DrgOgcdAbility,
    NastrondReady, StarcrossReady, DiveReady, DragonsFlight,
    LifeOfTheDragon,
    LanceChargeBuff,
    LifeSurgeBuff
} from "./drg_types";
import {Litany} from "@xivgear/core/sims/buffs";
import * as Actions from './drg_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxStr} from "@xivgear/core/sims/common/potion";

function formatTime(time: number) {
    const negative = time < 0;
    // noinspection AssignmentToFunctionParameterJS
    time = Math.abs(time);
    const minute = Math.floor(time / 60);
    const second = time % 60;
    return (`${negative ? '-' : ''}${minute}:${second.toFixed(2).padStart(5, '0')}`);
}

export interface DrgSimResult extends CycleSimResult {

}

export interface DrgSettings extends SimSettings {
    // If we use potions (used every six minutes).
    usePotion: boolean;
    // the length of the fight in seconds
    fightTime: number;
    // ePT opener. (false is TT opener)
    useEptOpener: boolean;
}

export interface DrgSettingsExternal extends ExternalCycleSettings<DrgSettings> {

}

export const drgSpec: SimSpec<DrgSim, DrgSettingsExternal> = {
    stub: "drg-sim",
    displayName: "DRG Sim",
    description: `Simulates a DRG rotation for levels 100/90/80/70.
If potions are enabled, pots in the burst window every 6m (i.e. 0m, 6m, 12m, etc).
Defaults to simulating a killtime of 8m 30s (510s).`,
    makeNewSimInstance: function (): DrgSim {
        return new DrgSim();
    },
    loadSavedSimInstance: function (exported: DrgSettingsExternal) {
        return new DrgSim(exported);
    },
    supportedJobs: ['DRG'],
    supportedLevels: [100, 90, 80, 70],
    isDefaultSim: true,
    maintainers: [{
        name: 'Rika',
        contact: [{
            type: 'discord',
            discordTag: 'syntheticglottalstop',
            discordUid: '1111309997482193017',
        }],
    }],
};

class RotationState {
    // Treat DRG's alternating 5+5 combo like a 10-step combo.
    private _combo: number = 1; //Start after 1st step since that could be either True Thrust or Raiden Thrust.

    get combo() {
        return this._combo;
    }
    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 10) this._combo = 0;
    }
}

class DrgCycleProcessor extends CycleProcessor<DrgGaugeManager> {
    rotationState: RotationState;

    comboActions: DrgGcdAbility[] = [
        Actions.TrueThrust, Actions.Disembowel, Actions.ChaosThrust, Actions.WheelingThrust, Actions.Drakesbane,
        Actions.TrueThrust, Actions.VorpalThrust, Actions.FullThrust, Actions.FangAndClaw, Actions.Drakesbane,
    ];

    // Needed to have the correct number of charges at this level.
    lifeSurgeAction: DrgOgcdAbility;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.rotationState = new RotationState();
        this.updateComboActionsForLevel(this.stats.level);
        this.lifeSurgeAction = this.applyLevelModifiers(Actions.LifeSurge) as DrgOgcdAbility;
    }

    override createGaugeManager(): DrgGaugeManager {
        return new DrgGaugeManager(this.stats.level);
    }

    override use(ability: Ability): AbilityUseResult {
        return super.use(ability);
    }

    updateComboActionsForLevel(level: number) {
        if (this.stats.level >= 76) {
            this.comboActions[0] = Actions.RaidenThrust;
            this.comboActions[0 + 5] = Actions.RaidenThrust;
        }
        if (this.stats.level >= 86) {
            this.comboActions[2] = Actions.ChaoticSpring;
            this.comboActions[2 + 5] = Actions.HeavensThrust;
        }
        if (this.stats.level >= 96) {
            this.comboActions[1] = Actions.SpiralBlow;
            this.comboActions[1 + 5] = Actions.LanceBarrage;
        }
    }

    getComboToUse() {
        return this.comboActions[this.rotationState.combo++];
    }

    inBurst(): boolean {
        const timeIntoTwoMinutes = this.currentTime % 120;

        // Seven seconds after every (i.e. 0:07, 2:07, etc) burst, buffs will be up,
        // and will remain up for twenty seconds.
        return 7 < timeIntoTwoMinutes && timeIntoTwoMinutes < 27;
    }

    // If the fight is ending within the next 12 seconds (to dump resources)
    fightEndingSoon(): boolean {
        return this.remainingTime < 12;
    }

    shouldPot(): boolean {
        const sixMinutesInSeconds = 360;
        const timeInSixMinuteWindow = this.currentTime % sixMinutesInSeconds;
        return timeInSixMinuteWindow > 2 && timeInSixMinuteWindow < 22;
    }

    findActiveBuff(buffToFind: Buff) {
        return this.getActiveBuffs().find(buff => buff.name === buffToFind.name);
    }

    isBuffActive(buffToFind: Buff) {
        return this.findActiveBuff(buffToFind) !== undefined;
    }

    getRemainingBuffDuration(buffToFind: Buff) {
        const buffData = this.getActiveBuffData(buffToFind);
        if (buffData === null) return 0;
        return buffData.end - this.currentTime;
    }
}

export class DrgSim extends BaseMultiCycleSim<DrgSimResult, DrgSettings, DrgCycleProcessor> {
    spec = drgSpec;
    shortName = "drg-sim";
    displayName = drgSpec.displayName;
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: this.settings.fightTime,
        cycles: 0,
        which: 'totalTime',
        cutoffMode: 'prorate-gcd',
    };

    constructor(settings?: DrgSettingsExternal) {
        super('DRG', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): DrgCycleProcessor {
        return new DrgCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeDefaultSettings(): DrgSettings {
        return {
            usePotion: true,
            // 8 minutes and 30s, or 510 seconds
            // This is chosen since it's two pots, five bursts,
            // and is somewhat even between the two main GCDs.
            fightTime: (8 * 60) + 30,
            useEptOpener: true,
        };
    }

    useComboGCD(cp: DrgCycleProcessor) {
        this.use(cp, cp.getComboToUse());
    }

    // oGCD priority: hard cooldowns.
    ogcdPrio1 = [Actions.LanceCharge, Actions.BattleLitany, Actions.Geirskogul, Actions.HighJump, Actions.Jump, Actions.DragonfireDive];

    useDrgRotation(cp: DrgCycleProcessor) {
        ////////
        ///oGCDs
        ////////

        // Priority: Hard cooldowns (use ASAP)
        // Test them in order of time until ready.
        this.ogcdPrio1.sort((a, b) => cp.timeUntilReady(a) - cp.timeUntilReady(b));
        for (const ogcd of this.ogcdPrio1) {
            // Jump is not available above level 74
            if (ogcd.name === "Jump" && cp.stats.level >= 74) {
                continue;
            }
            // High Jump is not available below level 74
            if (ogcd.name === "High Jump" && cp.stats.level < 74) {
                continue;
            }
            if (cp.canUseWithoutClipping(ogcd)) {
                this.use(cp, ogcd);
            }
        }

        const nextGCD = cp.comboActions[cp.rotationState.combo];

        // Life Surge priority:
        // FIXME: Hard-coded because the level modifier is not working and I have failed to find the source.
        let needsLsNextGcd = false;
        /*const lcOffset = this.settings.useEptOpener ? 5.35 : 2.94;
        const nextGCDTimeIntoOneMinute = cp.nextGcdTime % 60;
        if (lcOffset < nextGCDTimeIntoOneMinute && nextGCDTimeIntoOneMinute < lcOffset + 20) {*/
        /*if (cp.isBuffActive(LanceChargeBuff) && cp.isBuffActive(LifeOfTheDragon)) {*/
        if (!cp.isBuffActive(LifeSurgeBuff)) {
            if (cp.isBuffActive(LanceChargeBuff) && cp.isBuffActive(LifeOfTheDragon)) {
                if (nextGCD.name === "Drakesbane" || nextGCD.name === "Heavens' Thrust") {
                    needsLsNextGcd = true;
                }
            }
        }

        if (cp.shouldPot() && cp.canUseWithoutClipping(potionMaxStr)) {
            this.use(cp, potionMaxStr);
        }

        // Priority: Can we fit WWT in buffs?
        if (cp.gaugeManager.firstmindsFocus === 2) {
            // How many combo GCDs until we overcap WWT?
            const gcdsUntilOvercap = 5 - (cp.rotationState.combo % 5);
            const timeUntilOvercap = cp.stats.gcdPhys(2.5) * gcdsUntilOvercap;

            // Time until Lance Charge, Geirskogul.
            const timeUntilLC = cp.timeUntilReady(Actions.LanceCharge) + Actions.LanceCharge.appDelay;
            const timeUntilBL = cp.timeUntilReady(Actions.BattleLitany) + Actions.BattleLitany.appDelay;
            const timeUntilGsk = cp.timeUntilReady(Actions.Geirskogul) + Actions.Geirskogul.appDelay;

            // Maybe they are already active?
            const timeLeftInLC = cp.getRemainingBuffDuration(LanceChargeBuff);
            const timeLeftInGsk = cp.getRemainingBuffDuration(LifeOfTheDragon);
            //const timeLeftInBL = cp.getRemainingBuffDuration(Litany);

            // Can we fit WWT in both buffs?
            const canFitInLC = timeUntilLC < timeUntilOvercap;
            const canFitInGsk = timeUntilGsk < timeUntilOvercap;
            const canFitInBoth = Math.max(timeUntilGsk, timeUntilLC) < timeUntilOvercap ||
                            (canFitInLC && timeLeftInGsk > timeUntilLC) ||
                            (canFitInGsk && timeLeftInLC > timeUntilGsk);

            if (canFitInBoth || canFitInLC || canFitInGsk) {
                // Don't use it yet.
            }
            else {
                if (cp.canUseWithoutClipping(Actions.WyrmwindThrust)) {
                    this.use(cp, Actions.WyrmwindThrust);
                }
            }
        }

        if (needsLsNextGcd) {
            //console.log(`tried to LS @${Math.floor(cp.currentTime/60)}:${Math.round(100*(cp.currentTime%60))/100}`);
            //console.log(cp.isReady(cp.lifeSurgeAction));
            if (cp.canUseWithoutClipping(cp.lifeSurgeAction)) {
                this.use(cp, cp.lifeSurgeAction);
            }
        }
        else {
            // Priority: Filler oGCDs (use when nothing else needs to be pressed immediately)
            if (cp.isBuffActive(NastrondReady) && cp.canUseWithoutClipping(Actions.Nastrond)) {
                this.use(cp, Actions.Nastrond);
            }
            if (cp.isBuffActive(LifeOfTheDragon)) {
                if (cp.stats.level >= 80 && cp.canUseWithoutClipping(Actions.Stardiver)) {
                    this.use(cp, Actions.Stardiver);
                }
                if (cp.isBuffActive(StarcrossReady)) {
                    if (cp.canUseWithoutClipping(Actions.Starcross)) {
                        this.use(cp, Actions.Starcross);
                    }
                }
            }
            if (cp.isBuffActive(DiveReady)) {
                if (cp.canUseWithoutClipping(Actions.MirageDive)) {
                    this.use(cp, Actions.MirageDive);
                }
            }
            if (cp.isBuffActive(DragonsFlight)) {
                if (cp.canUseWithoutClipping(Actions.RiseOfTheDragon)) {
                    this.use(cp, Actions.RiseOfTheDragon);
                }
            }
        }

        // If we don't have time to use a GCD, return early.
        if (cp.remainingGcdTime <= 0) {
            return;
        }

        this.useComboGCD(cp);
    }

    use(cp: DrgCycleProcessor, ability: Ability): AbilityUseResult {
        if (cp.currentTime >= cp.totalTime) {
            return null;
        }

        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (ability.type === 'ogcd' && cp.canUseWithoutClipping(ability)) {
            const readyAt = cp.cdTracker.statusOf(ability).readyAt.absolute;
            if (cp.totalTime > readyAt) {
                cp.advanceTo(readyAt);
            }
        }

        // Only use potion if enabled in settings
        if (!this.settings.usePotion && ability.name.includes("of Strength")) {
            return null;
        }

        return cp.use(ability);
    }

    private useOpener(cp: DrgCycleProcessor, useEptOpener: boolean) {
        if (useEptOpener) {
            this.use(cp, Actions.ElusiveJump);
            cp.advanceTo(15 - 0.85);
            this.use(cp, Actions.EnhancedPiercingTalon);
            this.use(cp, Actions.TrueThrust);
            this.use(cp, potionMaxStr);
            this.useComboGCD(cp);
            this.use(cp, Actions.LanceCharge);
            this.use(cp, Actions.BattleLitany);
            this.useComboGCD(cp);
            this.use(cp, Actions.Geirskogul);
        }
        else {
            this.use(cp, Actions.TrueThrust);
            this.useComboGCD(cp);
            this.use(cp, Actions.LanceCharge);
            this.use(cp, potionMaxStr);
            this.useComboGCD(cp);
            this.use(cp, Actions.BattleLitany);
            this.use(cp, Actions.Geirskogul);
        }
        this.useComboGCD(cp);
        if (cp.stats.level >= 74) {
            this.use(cp, Actions.HighJump);
        }
        else {
            this.use(cp, Actions.Jump);
        }
        this.use(cp, Actions.LifeSurge);
        this.useComboGCD(cp);
        this.use(cp, Actions.DragonfireDive);
        this.use(cp, Actions.Nastrond);
        this.useComboGCD(cp);
        if (cp.stats.level >= 80) {
            this.use(cp, Actions.Stardiver);
        }
        this.useComboGCD(cp);
        if (cp.stats.level >= 100) {
            this.use(cp, Actions.Starcross);
        }
        if (cp.stats.level >= 88) {
            this.use(cp, Actions.LifeSurge);
        }
        this.useComboGCD(cp);
        if (cp.stats.level >= 92) {
            this.use(cp, Actions.RiseOfTheDragon);
        }
        this.use(cp, Actions.MirageDive);
    }

    private printCooldownDrift(cp: DrgCycleProcessor, abilityName: string) {
        const usedAbilities = cp.usedAbilities.filter(used => used.ability.name === abilityName);

        const uses = usedAbilities.length;
        const drifts = [];
        for (let i = 0; i < uses - 1; ++i) {
            const diff = usedAbilities[i + 1].usedAt - usedAbilities[i].usedAt;
            let drift = diff - usedAbilities[i].ability.cooldown.time;
            drift = Math.round(1e3 * drift) / 1e3;
            if (drift > 0) {
                drifts.push(drift);
            }
        }

        if (drifts.length > 0) {
            cp.addSpecialRow(`${abilityName} - uses: ${uses}, drift: ${drifts.filter(t => t > 0).map(t => `${t}s`).join(", ")}`, 0);
        }
        else {
            cp.addSpecialRow(`${abilityName} - uses: ${uses}`, 0);
        }
    }

    private printGcdClipping(cp: DrgCycleProcessor) {
        const GCD_CLIP_ALLOWED = 0.01;

        const gcds = cp.usedAbilities.filter(used => used.ability.type === 'gcd');

        let totalClip = 0;
        const clipTimes = [];
        for (let i = 0; i < gcds.length - 1; ++i) {
            // The highest between cast time and GCD time.
            const castTime = cp.castTime(gcds[i].ability as GcdAbility, gcds[i].combinedEffects);
            const gcdTime = cp.gcdTime(gcds[i].ability as GcdAbility, gcds[i].combinedEffects);
            const checkTime = Math.max(castTime, gcdTime);
            if (gcds[i + 1].usedAt - gcds[i].usedAt > checkTime) {
                const clipAmount = gcds[i + 1].usedAt - gcds[i].usedAt - checkTime;
                totalClip += clipAmount;

                if (clipAmount > GCD_CLIP_ALLOWED) {
                    clipTimes.push(formatTime(gcds[i].usedAt));
                }
            }
        }

        if (totalClip > GCD_CLIP_ALLOWED) {
            cp.addSpecialRow(`GCD clips: ${totalClip.toFixed(2)}s, ${clipTimes.join(", ")}`, 0);
        }
        else {
            cp.addSpecialRow(`No GCD clips`, 0);
        }
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<DrgCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdMag(2.5);
        const settings = { ...this.settings };
        const outer = this;

        console.log(`[DRG Sim] Running Rotation for ${gcd} GCD...`);
        console.log(`[DRG Sim] Settings configured: ${JSON.stringify(settings)}`);
        return [{
            cycleTime: 120,
            apply(cp: DrgCycleProcessor) {
                outer.useOpener(cp, settings.useEptOpener);

                cp.remainingCycles(() => {
                    outer.useDrgRotation(cp);
                });

                // Recap cooldown drift.
                cp.addSpecialRow(">>> Recap cooldown drift:", 0);
                outer.printCooldownDrift(cp, "Battle Litany");
                outer.printCooldownDrift(cp, "Lance Charge");
                outer.printCooldownDrift(cp, "Geirskogul");
                if (cp.stats.level > 76) {
                    outer.printCooldownDrift(cp, "High Jump");
                }
                else {
                    outer.printCooldownDrift(cp, "Jump");
                }
                outer.printGcdClipping(cp);
            },
        }];
    }
}
