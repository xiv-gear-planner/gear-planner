import { PreDmgAbilityUseRecordUnf, AbilityUseResult, CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation } from "@xivgear/core/sims/cycle_sim";
import { Ability, Buff, OgcdAbility, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { VprGauge } from "./vpr_gauge";
import { VprAbility, VprExtraData, VprGcdAbility } from "./vpr_types";
import * as Actions from "./vpr_actions";
import { FlanksbaneVenom, FlankstungVenom, HindsbaneVenom, HindstungVenom, HuntersInstinct, ReadyToReawaken, Swiftscaled } from "./vpr_buffs";
import { potionMaxDex } from "@xivgear/core/sims/common/potion";
import { sum } from "@xivgear/core/util/array_utils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";

export interface VprSimResult extends CycleSimResult {
}

export interface VprSimSettings extends SimSettings {

}

export interface VprSimSettingsExternal extends ExternalCycleSettings<VprSimSettings> {
}


export const vprSheetSpec: SimSpec<VprSheetSim, VprSimSettingsExternal> = {
    stub: "vpr-sheet-sim",
    displayName: "VPR Sim",
    makeNewSimInstance: function (): VprSheetSim {
        return new VprSheetSim();
    },
    loadSavedSimInstance: function (exported: VprSimSettingsExternal) {
        return new VprSheetSim(exported);
    },
    supportedJobs: ['VPR'],
    isDefaultSim: true,
};

class RotationState {
    private _comboStep: number = 0;
    get comboStep() {
        return this._comboStep;
    }
    set comboStep(newCombo: number) {
        this._comboStep = newCombo % 3;
    }
    private _nextSecondStep: number = 0;
    get nextSecondStep() {
        return this._nextSecondStep;
    }
    set nextSecondStep(new2ndGcd: number) {
        this._nextSecondStep = new2ndGcd % 2;
    }

    private _nextFirstStep: number = 0;
    get nextFirstStep() {
        return this._nextFirstStep;
    }
    set nextFirstStep(newFirstStep: number) {
        this._nextFirstStep = newFirstStep % 2;
    }

    public numDreadwindersUsed: number = 0;
    public lastComboTime: number = 0;
    public lastDualWieldFinisher: VprGcdAbility = null;
}
export class VprCycleProcessor extends CycleProcessor {

    gauge: VprGauge;

    rotationState: RotationState;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new VprGauge();
        this.rotationState = new RotationState();
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {

        // Add gauge data to this record for the UI
        const extraData: VprExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    getBuffIfActive(buff: Buff): Buff {
        return this.getActiveBuffs().find(b => b.statusId === buff.statusId);
    }

    override use(ability: Ability): AbilityUseResult {
        const vprAbility = ability as VprAbility;

        if (vprAbility.updateGauge) {

            /** prevent weird gauge update if an auto lands between now and nextGcdTime */
            if (ability.type === 'gcd' &&  this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            }

            /** Don't update gauge if we are awakening and ready to reawaken */
            if ( !(vprAbility.id === Actions.Reawaken.id && this.getBuffIfActive(ReadyToReawaken)) ) {
                vprAbility.updateGauge(this.gauge);
            }
        }

        if (vprAbility.id === Actions.FlanksbaneFang.id
            || vprAbility.id === Actions.FlankstingStrike.id
            || vprAbility.id === Actions.HindsbaneFang.id
            || vprAbility.id === Actions.HindstingStrike.id
        ) {
            this.rotationState.lastDualWieldFinisher = vprAbility as VprGcdAbility;
        }

        return super.use(ability);
    }

    override useOgcd(ability: OgcdAbility): AbilityUseResult {

        /** If the ogcd can be used without clipping, do so.
         * NOTE: You still need to check if you can use without clipping when making rotation decisions.
         * This just forces the ogcd through if you already know you can use it.
        */
        if (this.canUseWithoutClipping(ability)) {
            const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
            if (this.totalTime > readyAt) {
                this.advanceTo(readyAt);
            }
        }

        return this.cdTracker.canUse(ability) ? super.useOgcd(ability) : null;
    }

    /** Advances to as late as possible.
     * NOTE: I'm adding an extra 20ms to each animation lock to make sure we don't hit anything that's impossible to achieve ingame.
     */
    advanceForLateWeave(weaves: OgcdAbility[]) {
        const pingAndServerDelayAdjustment = 0.02;
        const totalAnimLock = sum(weaves.map(ability => (ability.animationLock ?? STANDARD_ANIMATION_LOCK) + pingAndServerDelayAdjustment));
        const remainingtime = this.nextGcdTime - this.currentTime;

        if (totalAnimLock > remainingtime) {
            return;
        }

        this.advanceTo(this.currentTime + (remainingtime - totalAnimLock));
    }

    useHuntersCoil() {
        this.useGcd(Actions.HuntersCoil);
        this.useOgcd(Actions.TwinfangBite);
        this.useOgcd(Actions.TwinbloodBite);
    }

    useSwiftskinsCoil() {
        this.useGcd(Actions.SwiftskinsCoil);
        this.useOgcd(Actions.TwinbloodBite);
        this.useOgcd(Actions.TwinfangBite);
    }

    useUncoiledFury() {
        this.useGcd(Actions.UncoiledFury);
        this.useOgcd(Actions.UncoiledTwinfang);
        this.useOgcd(Actions.UncoiledTwinblood);
    }

    useDreadWinder() {
        this.useGcd(Actions.Vicewinder);
        this.rotationState.numDreadwindersUsed += 1;
    }

    useDreadWinderCombo() {
        this.useDreadWinder();

        if (this.getActiveBuffData(HuntersInstinct) === null) {
            console.warn("No Hunter's Instinct when starting Dreadwinder Combo!");
        }
        if (this.getActiveBuffData(Swiftscaled) === null) {
            console.warn("no Swiftscaled when starting Dreadwinder Combo!");
        }

        if (this.getActiveBuffData(HuntersInstinct)?.end < this.getActiveBuffData(Swiftscaled)?.end) {
            this.useHuntersCoil();
            this.useSwiftskinsCoil();
        }
        else {
            this.useSwiftskinsCoil();
            this.useHuntersCoil();
        }
    }

    firstComboGcds: VprGcdAbility[] = [Actions.ReavingFangs, Actions.SteelFangs];
    secondComboGcds: VprGcdAbility[] = [Actions.SwiftskinsSting, Actions.HuntersSting];
    public useDualWieldCombo() {
        switch (this.rotationState.comboStep) {
            case 0:
                this.useGcd(this.firstComboGcds[this.rotationState.nextFirstStep++]);
                break;
            case 1:
                this.useGcd(this.secondComboGcds[this.rotationState.nextSecondStep++]);
                break;
            case 2:
            /** Use finisher based on buff */
                if (this.getBuffIfActive(HindsbaneVenom)) {
                    this.useGcd(Actions.HindsbaneFang);
                }
                else if (this.getBuffIfActive(HindstungVenom)) {
                    this.useGcd(Actions.HindstingStrike);
                }
                else if (this.getBuffIfActive(FlanksbaneVenom)) {
                    this.useGcd(Actions.FlanksbaneFang);
                }
                else if (this.getBuffIfActive(FlankstungVenom)) {
                    this.useGcd(Actions.FlankstingStrike);
                }
                else { // No buff running; Pick arbitrarily based on previous 2nd combo
                /** If we just used Hunter's sting */
                    if (this.rotationState.nextSecondStep === 0) {
                        this.useGcd(Actions.HindsbaneFang); // Chosen arbitrarily from the flank options
                    }
                    else if (this.rotationState.nextSecondStep === 1) { // If we just used Swiftskin's sting
                        this.useGcd(Actions.FlanksbaneFang); // Chosen arbitrarily from the hind options
                    }
                }
                this.useOgcd(Actions.DeathRattle);
                break;
        }

        this.rotationState.comboStep += 1;
        this.rotationState.lastComboTime = this.currentTime;
    }

    useReawaken() {
        this.useGcd(Actions.Reawaken);

        this.useGcd(Actions.FirstGeneration);
        this.useOgcd(Actions.FirstLegacy);
        this.useGcd(Actions.SecondGeneration);
        this.useOgcd(Actions.SecondLegacy);
        this.useGcd(Actions.ThirdGeneration);
        this.useOgcd(Actions.ThirdLegacy);
        this.useGcd(Actions.FourthGeneration);
        this.useOgcd(Actions.FourthLegacy);

        this.useGcd(Actions.Ouroboros);
    }

    useDoubleReawaken() {
        this.useReawaken();
        this.useReawaken();

        /** Requirements for using UF:
         * - need to not break combo
         * - need to use combo finisher before buff wears off
        */
        const comboBreakTime = this.rotationState.lastComboTime + 30;
        const gcdAfterUF = this.nextGcdTime + this.gcdTime(Actions.UncoiledFury);
        let numCombosNeeded = 2 - this.rotationState.comboStep + 1;

        if (gcdAfterUF < comboBreakTime) { // if the gcd after has time to continue combo

            this.useUncoiledFury();
        }

        /** Use combo till we're good with finisher
         * Note: always iterates at least once*/
        while (numCombosNeeded > 0) {
            this.useDualWieldCombo();
            numCombosNeeded--;
        }

        this.rotationState.numDreadwindersUsed = 0;
    }

    useOpener() {
        this.useDualWieldCombo(); // Will be dread fangs because we don't have Noxious Gnash
        this.useOgcd(Actions.SerpentsIre);
        this.useDualWieldCombo(); // Will be Swifstkin's Sting because it is first to be used
        this.useGcd(Actions.Vicewinder);

        this.advanceForLateWeave([potionMaxDex]);
        this.useOgcd(potionMaxDex);

        this.useHuntersCoil();
        this.useSwiftskinsCoil();

        this.useReawaken();

        this.useDualWieldCombo();
        this.useUncoiledFury();
        this.useUncoiledFury();
        this.useDreadWinder();
        this.useUncoiledFury();
        this.useHuntersCoil();
        this.useSwiftskinsCoil();
    }

    getReawakenDuration(): number {
        const reawakenGcd = this.gcdTime(Actions.Reawaken);
        const generationGcd = this.gcdTime(Actions.FirstGeneration);
        const ouroborosGcd = this.gcdTime(Actions.Ouroboros);

        return reawakenGcd + 4 * generationGcd + ouroborosGcd;
    }

    getGcdTimeAfterSerpentsIre(): number {
        const gcdTime = this.gcdTime(Actions.ReavingFangs); // We already have a rule not to use non-dualwield gcds, so we can be assured that this is accurate.

        const serpentsIreReady = this.cdTracker.statusOf(Actions.SerpentsIre).readyAt.absolute;
        let gcdAfterSerpentsIre = this.nextGcdTime;

        while (gcdAfterSerpentsIre < serpentsIreReady) {
            gcdAfterSerpentsIre += gcdTime;
        }

        /** If ire gets pushed back due to clipping, push back one gcd */
        if (serpentsIreReady + (Actions.SerpentsIre.animationLock ?? STANDARD_ANIMATION_LOCK) > gcdAfterSerpentsIre) {
            gcdAfterSerpentsIre += 1;
        }

        return gcdAfterSerpentsIre;
    }

    isImmediatelyBeforeBurst(): boolean {

        const gcdTime = this.gcdTime(Actions.ReavingFangs); // We already have a rule not to use non-dualwield gcds, so we can be assured that this is accurate.
        const gcdAfterSerpentsIre = this.getGcdTimeAfterSerpentsIre();
        const reawakenStart = gcdAfterSerpentsIre + gcdTime;

        return Math.abs(reawakenStart - this.nextGcdTime - 3 * gcdTime) < 0.0001;
    }

    getGaugeAtTime(start: number = this.nextGcdTime, targetTime: number, startingGuage: number = this.gauge.serpentOfferings) {

        /** We are going to shift the GCDs around to make math easier.
         * Pretend we are starting after all of (hypothetical reawaken, UFs, Twinblade Combos) have been used, immediately.
         * That means the rest of the gcds before 2min reawaken are *all* dual wield combos.
        */
        const numTwinbladeCombosToUse = 3 - this.rotationState.numDreadwindersUsed;
        const numRattlingCoils = this.gauge.rattlingCoils + numTwinbladeCombosToUse + (targetTime < this.cdTracker.statusOf(Actions.SerpentsIre).readyAt.absolute ? 0 : 1); // +1 for Serpent's ire
        const numUFs = Math.max(numRattlingCoils - 3, 0);

        const UFGcd = this.gcdTime(Actions.UncoiledFury);
        const dualWieldGcd = this.gcdTime(Actions.ReavingFangs);
        const twinbladeGcd = this.gcdTime(Actions.Vicewinder);

        start += numUFs * UFGcd + 3 * numTwinbladeCombosToUse * twinbladeGcd;
        startingGuage += 10 * numTwinbladeCombosToUse;

        let numFinishersBeforeTarget = 0;

        /** Advance to our next combo-neutral spot, to make counting easier. */
        let combo = this.rotationState.comboStep;
        if (combo !== 0) {
            while (combo !== 0) {
                start += dualWieldGcd;
                combo = (combo + 1) % 3;
            }
            numFinishersBeforeTarget += 1;
        }

        const numGcdsBeforeTarget = Math.max(Math.floor((targetTime - start) / dualWieldGcd), 0);
        numFinishersBeforeTarget += Math.floor(numGcdsBeforeTarget / 3);

        startingGuage += 10 * numFinishersBeforeTarget;

        return startingGuage;
    }

    willHaveGaugeForBurst(): boolean {

        const nextBurstStart = this.getGcdTimeAfterSerpentsIre() + 1 * this.gcdTime(Actions.ReavingFangs);

        return this.getGaugeAtTime(this.nextGcdTime + this.getReawakenDuration(), nextBurstStart, this.gauge.serpentOfferings - 50) >= 50;
    }

    rotationStep() {

        if (this.canUseWithoutClipping(Actions.SerpentsIre)) {
            this.useOgcd(Actions.SerpentsIre);
            if (this.gauge.serpentOfferings === 100 && this.gauge.rattlingCoils > 0 && this.rotationState.comboStep === 2) {
                this.useUncoiledFury();
            }
            else {
                this.useDualWieldCombo();
            }

            if (this.canUseWithoutClipping(potionMaxDex)) {
                this.advanceForLateWeave([potionMaxDex]);
                this.useOgcd(potionMaxDex);
            }

            this.useDoubleReawaken();
            return;
        }

        /** Pre-burst logic */
        if (this.cdTracker.statusOf(Actions.SerpentsIre).readyAt.absolute - this.nextGcdTime < 10) {

            if (this.gauge.serpentOfferings === 100 && this.gauge.rattlingCoils > 0 && this.rotationState.comboStep === 2) {
                this.useUncoiledFury();
            }
            else {
                this.useDualWieldCombo();
            }

            return;
        }

        if (this.cdTracker.canUse(Actions.Vicewinder)
            && this.gauge.serpentOfferings + 10 <= 100
            && this.cdTracker.statusOfAt(Actions.SerpentsIre, this.nextGcdTime).readyAt.relative > 10) {

            if (this.gauge.rattlingCoils === 3) {
                this.useUncoiledFury();
                this.useDreadWinderCombo();
                return;
            }
            else {
                this.useDreadWinderCombo();
                return;
            }
        }

        const postReawakenTime = this.nextGcdTime + this.getReawakenDuration();
        const nextSecondaryBuffRefresh = (this.cdTracker.statusOfAt(Actions.Vicewinder, postReawakenTime).readyToUse) ?
            postReawakenTime + this.gcdTime(Actions.Vicewinder)
            : postReawakenTime + ((1 - this.rotationState.comboStep) % 3) * this.gcdTime(Actions.ReavingFangs);

        if (this.gauge.serpentOfferings >= 50
            && nextSecondaryBuffRefresh < this.getActiveBuffData(HuntersInstinct).end
            && nextSecondaryBuffRefresh < this.getActiveBuffData(Swiftscaled).end
            && this.willHaveGaugeForBurst()) {

            this.useReawaken();
            return;
        }

        if (this.gauge.rattlingCoils > 2
           || (this.gauge.rattlingCoils > 0 && this.cdTracker.statusOf(Actions.SerpentsIre).readyAt.relative > this.remainingGcdTime)
           || (this.rotationState.comboStep === 2 && this.gauge.serpentOfferings === 100 && this.gauge.rattlingCoils > 0)
        ) {
            this.useUncoiledFury();
            return;
        }

        this.useDualWieldCombo();
    }
}

export class VprSheetSim extends BaseMultiCycleSim<VprSimResult, VprSimSettings> {

    spec = vprSheetSpec;
    shortName = "vpr-sheet-sim";
    displayName = vprSheetSpec.displayName;

    constructor(settings?: VprSimSettingsExternal) {
        super('VPR', settings);
    }

    makeDefaultSettings(): VprSimSettings {
        return {};
    }

    protected createCycleProcessor(settings: MultiCycleSettings): VprCycleProcessor {
        return new VprCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }
    getRotationsToSimulate(): Rotation<VprCycleProcessor>[] {
        return [{
            cycleTime: 120,

            apply(cp: VprCycleProcessor) {
                cp.useOpener();
                while (cp.remainingTime > 0) {
                    cp.rotationStep();
                }
            },
        }];
    }
}
