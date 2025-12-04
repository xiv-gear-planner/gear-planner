import {Ability, GcdAbility, Buff, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
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
import {DrgGaugeManager} from "./drg_gauge";
import {
    DrgGcdAbility, DrgOgcdAbility,
    NastrondReady, StarcrossReady, DiveReady, DragonsFlight,
    LifeOfTheDragon,
    LanceChargeBuff,
    LifeSurgeBuff
} from "./drg_types";
//import {Litany} from "@xivgear/core/sims/buffs"
import * as Actions from './drg_actions';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {potionMaxStr} from "@xivgear/core/sims/common/potion";
//import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";

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
    // double Mirage Dive.
    useDoubleMd: boolean;
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
        if (this._combo >= 10) {
            this._combo = 0;
        }
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
        return timeInSixMinuteWindow >= 0 && timeInSixMinuteWindow <= 20;
    }

    findActiveBuff(buffToFind: Buff) {
        return this.getActiveBuffs().find(buff => buff.name === buffToFind.name);
    }

    isBuffActive(buffToFind: Buff) {
        return this.findActiveBuff(buffToFind) !== undefined;
    }

    getRemainingBuffDuration(buffToFind: Buff) {
        const buffData = this.getActiveBuffData(buffToFind);
        if (buffData === null) {
            return 0;
        }
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
            useDoubleMd: false,
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

        // Mirage Dive is higher priority because of double MD.
        if (cp.isBuffActive(DiveReady)) {
            // For double MD: wait until Lance Charge & Geirskogul to use Mirage Dive.
            const timeForDive = cp.getRemainingBuffDuration(DiveReady);

            const timeUntilLC = cp.timeUntilReady(Actions.LanceCharge) + Actions.LanceCharge.appDelay;
            const timeUntilGsk = cp.timeUntilReady(Actions.Geirskogul) + Actions.Geirskogul.appDelay;

            const timeLeftInLC = cp.getRemainingBuffDuration(LanceChargeBuff);
            const timeLeftInGsk = cp.getRemainingBuffDuration(LifeOfTheDragon);

            const canFitInLC = timeUntilLC < timeForDive;
            const canFitInGsk = timeUntilGsk < timeForDive;
            const canFitInBoth = Math.max(timeUntilGsk, timeUntilLC) < timeForDive ||
                            (canFitInLC && timeLeftInGsk > timeUntilLC) ||
                            (canFitInGsk && timeLeftInLC > timeUntilGsk);

            if (canFitInBoth || canFitInLC || canFitInGsk) {
                // Don't use it yet.
            }
            else if (cp.canUseWithoutClipping(Actions.MirageDive)) {
                this.use(cp, Actions.MirageDive);
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
        // These nested ifs look ugly but I think it keeps the logic readable so I'll keep it that way for now.
        if (!cp.isBuffActive(LifeSurgeBuff)) {
            if (cp.isBuffActive(LanceChargeBuff) && cp.isBuffActive(LifeOfTheDragon)) {
                if (nextGCD.name === "Drakesbane" || nextGCD.name === "Heavens' Thrust") {
                    needsLsNextGcd = cp.canUseWithoutClipping(cp.lifeSurgeAction);
                }
                // If double MD, check if we need to use LS on a weaker GCD like Chaotic Spring. Only relevant if we have more than 1 charge of LS.
                // It would be ideal to actually calculate the ideal GCDs ahead of time (stored in rotation state maybe),
                // For now the only use case is Chaotic Spring when doing double MD.
                // There would be other use cases in the future if we want to compare additional openers and/or prevent triple-weaving.
                if (cp.lifeSurgeAction.cooldown.charges > 1 && this.settings.useDoubleMd) {
                    // The combo loops every 10 minutes, so we can simply check if we are during the 6-minute burst.
                    const nextGCDTimeIntoTenMinutes = cp.nextGcdTime % (10 * 60);
                    const sixMinutes = 6 * 60;
                    if (sixMinutes < nextGCDTimeIntoTenMinutes && nextGCDTimeIntoTenMinutes < sixMinutes + 30) {
                        if (cp.cdTracker.statusOf(cp.lifeSurgeAction).currentCharges === 1) {
                            if (nextGCD.name === "Chaotic Spring") {
                                needsLsNextGcd = cp.canUseWithoutClipping(cp.lifeSurgeAction);
                            }
                        }
                    }
                    // The TT opener specifically needs the first LS on 4-minute burst to be used on Chaotic Spring.
                    const fourMinutes = 4 * 60;
                    if (fourMinutes < nextGCDTimeIntoTenMinutes && nextGCDTimeIntoTenMinutes < fourMinutes + 30) {
                        if (cp.cdTracker.statusOf(cp.lifeSurgeAction).currentCharges === 2) {
                            if (nextGCD.name === "Chaotic Spring") {
                                needsLsNextGcd = cp.canUseWithoutClipping(cp.lifeSurgeAction);
                            }
                        }
                    }
                }
            }
        }
        if (needsLsNextGcd) {
            //For debugging:
            /*
            const isLsReady = cp.isReady(cp.lifeSurgeAction);
            const lsReadyAt = cp.cdTracker.statusOf(cp.lifeSurgeAction).readyAt.absolute;
            const lsMaxDelayAt = cp.nextGcdTime - (cp.lifeSurgeAction.animationLock ?? STANDARD_ANIMATION_LOCK);
            console.log(`tried to LS @${formatTime(cp.currentTime)}`);
            console.log(`isReady: ${isLsReady}, readyAt: ${formatTime(lsReadyAt)}, maxDelay: ${formatTime(lsMaxDelayAt)}, diff: ${formatTime(lsMaxDelayAt - lsReadyAt)}`);
            */
            needsLsNextGcd = cp.canUseWithoutClipping(cp.lifeSurgeAction);
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
            const timeUntilGsk = cp.timeUntilReady(Actions.Geirskogul) + Actions.Geirskogul.appDelay;
            //const timeUntilBL = cp.timeUntilReady(Actions.BattleLitany) + Actions.BattleLitany.appDelay;

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

                // Special exception for TT+double MD, don't wait for Gsk or we will overcap because of MD's higher priority.
                if (!this.settings.useEptOpener && this.settings.useDoubleMd) {
                    // This happens on the 3, 8, and 10 minute bursts.
                    // The combo loops every 10 minutes, so we can simply check.
                    const currentTimeIntoTenMinutes = cp.currentTime % (10 * 60);
                    const threeMinutes = 3 * 60;
                    const eightMinutes = 8 * 60;
                    const tenMinutes = 10 * 60;
                    const notInOpener = cp.currentTime > 60;
                    if ((threeMinutes - 5 < currentTimeIntoTenMinutes && currentTimeIntoTenMinutes < threeMinutes + 25) ||
                            (eightMinutes - 5 < currentTimeIntoTenMinutes && currentTimeIntoTenMinutes < eightMinutes + 25) ||
                            (notInOpener && (tenMinutes - 5 < currentTimeIntoTenMinutes && currentTimeIntoTenMinutes < 25))) {
                        // Wait for LC but not Gsk.

                        // If this would overlap with a pot window, do not wait at all.
                        // (We would clip since LC is delayed for double MD and we want to pot in the same weave window)
                        const sixMinutesInSeconds = 360;
                        const timeInSixMinuteWindow = (cp.currentTime + timeUntilLC) % sixMinutesInSeconds;
                        const potWindowSoon = timeInSixMinuteWindow >= 0 && timeInSixMinuteWindow < 27;

                        if (potWindowSoon || timeLeftInLC > 0) {
                            if (cp.canUseWithoutClipping(Actions.WyrmwindThrust)) {
                                this.use(cp, Actions.WyrmwindThrust);
                            }
                        }
                    }
                }
            }
            else {
                if (cp.canUseWithoutClipping(Actions.WyrmwindThrust)) {
                    this.use(cp, Actions.WyrmwindThrust);
                }
            }
        }

        if (needsLsNextGcd) {
            this.use(cp, cp.lifeSurgeAction);
        }

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
        if (cp.isBuffActive(DragonsFlight)) {
            if (cp.canUseWithoutClipping(Actions.RiseOfTheDragon)) {
                this.use(cp, Actions.RiseOfTheDragon);
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

    private useOpener(cp: DrgCycleProcessor, useEptOpener: boolean, useDoubleMd: boolean) {
        if (useEptOpener) {
            this.use(cp, Actions.ElusiveJump);
            cp.advanceTo(15 - 0.85);
            this.use(cp, Actions.EnhancedPiercingTalon);
            this.use(cp, Actions.TrueThrust);
            this.use(cp, potionMaxStr);
            this.useComboGCD(cp);
            if (useDoubleMd) {
                // Delay Lance Charge by at least 0.2 when doing double MD to catch Mirage Dive.
                cp.advanceTo(cp.currentTime + 0.2 + 0.1);
            }
            this.use(cp, Actions.LanceCharge);
            this.use(cp, Actions.BattleLitany);
            this.useComboGCD(cp);
            this.use(cp, Actions.Geirskogul);
        }
        else {
            this.use(cp, Actions.TrueThrust);
            this.useComboGCD(cp);
            if (useDoubleMd) {
                // Delay Lance Charge by at least 0.2 when doing double MD to catch Mirage Dive.
                cp.advanceTo(cp.currentTime + 0.2 + 0.1);
            }
            this.use(cp, Actions.LanceCharge);
            this.use(cp, potionMaxStr);
            this.useComboGCD(cp);
            this.use(cp, Actions.BattleLitany);
            this.use(cp, Actions.Geirskogul);
        }
        this.useComboGCD(cp);
        if (useDoubleMd) {
            this.use(cp, Actions.DragonfireDive);
        }
        else {
            if (cp.stats.level >= 74) {
                this.use(cp, Actions.HighJump);
            }
            else {
                this.use(cp, Actions.Jump);
            }
        }
        this.use(cp, cp.lifeSurgeAction);
        this.useComboGCD(cp);
        if (!useDoubleMd) {
            this.use(cp, Actions.DragonfireDive);
        }
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
            this.use(cp, cp.lifeSurgeAction);
        }
        this.useComboGCD(cp);
        if (cp.stats.level >= 92) {
            this.use(cp, Actions.RiseOfTheDragon);
        }
        if (!useDoubleMd) {
            this.use(cp, Actions.MirageDive);
        }
        else {
            this.useComboGCD(cp);
            this.useComboGCD(cp);
            if (cp.stats.level >= 74) {
                this.use(cp, Actions.HighJump);
            }
            else {
                this.use(cp, Actions.Jump);
            }
            this.use(cp, Actions.MirageDive);
        }
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

    private printUses(cp: DrgCycleProcessor, abilityName: string) {
        const usedAbilities = cp.usedAbilities.filter(used => used.ability.name === abilityName);
        const uses = usedAbilities.length;
        cp.addSpecialRow(`\u00a0${abilityName} - uses: ${uses}`, 0);
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

    printDriftAndUsageSummary(cp: DrgCycleProcessor) {
        cp.addSpecialRow(">>> Recap cooldown drift:", 0);
        this.printCooldownDrift(cp, "Battle Litany");
        this.printCooldownDrift(cp, "Dragonfire Dive");
        if (cp.stats.level >= 92) {
            this.printUses(cp, "Rise of the Dragon");
        }
        this.printCooldownDrift(cp, "Lance Charge");
        this.printCooldownDrift(cp, "Geirskogul");
        this.printUses(cp, "Nastrond");
        if (cp.stats.level >= 80) {
            this.printUses(cp, "Stardiver");
            if (cp.stats.level >= 100) {
                this.printUses(cp, "Starcross");
            }
        }
        if (cp.stats.level > 76) {
            this.printCooldownDrift(cp, "High Jump");
        }
        else {
            this.printCooldownDrift(cp, "Jump");
        }
        this.printUses(cp, "Mirage Dive");
        if (cp.stats.level >= 90) {
            this.printUses(cp, "Wyrmwind Thrust");
        }
        this.printGcdClipping(cp);
    }

    getRotationsToSimulate(set: CharacterGearSet): Rotation<DrgCycleProcessor>[] {
        const gcd = set.results.computedStats.gcdPhys(2.5);
        const outer = this;

        console.log(`[DRG Sim] Running Rotation for ${gcd} GCD...`);

        return [true, false].flatMap(useEptOpener =>
            [true, false].flatMap(useDoubleMd => ({
                name: `${useEptOpener ? "ePT" : "TT"} Opener${useDoubleMd ? " (Double MD)" : ""}`,
                cycleTime: 120,
                apply(cp: DrgCycleProcessor) {
                    outer.settings.useEptOpener = useEptOpener;
                    outer.settings.useDoubleMd = useDoubleMd;
                    outer.useOpener(cp, useEptOpener, useDoubleMd);
                    cp.remainingCycles(() => {
                        outer.useDrgRotation(cp);
                    });
                    outer.printDriftAndUsageSummary(cp);
                },
            }))
        );
    }
}
