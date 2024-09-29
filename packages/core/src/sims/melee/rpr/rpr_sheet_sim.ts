import { ArcaneCircleBuff } from "@xivgear/core/sims/buffs";
import { Ability, Buff, OgcdAbility, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { PreDmgAbilityUseRecordUnf, AbilityUseResult, CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation } from "@xivgear/core/sims/cycle_sim";
import { potionMaxStr } from "@xivgear/core/sims/common/potion";
import * as Actions from "./rpr_actions";
import { RprAbility, RprExtraData, RprGcdAbility } from "./rpr_types";
import { RprGauge } from "./rpr_gauge";
import { DeathsDesign, IdealHost } from "./rpr_buff";
import { sum } from "@xivgear/core/util/array_utils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { animationLock } from "@xivgear/core/sims/ability_helpers";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";


export interface RprSheetSimResult extends CycleSimResult {
    arcaneCircleDrifts: number[];
    gluttonyDrifts: number[];
    soulSliceDrifts: number[];
}

export interface RprSimSettings extends SimSettings {

}

export interface RprSimSettingsExternal extends ExternalCycleSettings<RprSimSettings> {
}


export const rprSheetSpec: SimSpec<RprSheetSim, RprSimSettingsExternal> = {
    stub: "rpr-sheet-sim",
    displayName: "RPR Sim",
    makeNewSimInstance: function (): RprSheetSim {
        return new RprSheetSim();
    },
    loadSavedSimInstance: function (exported: RprSimSettingsExternal) {
        return new RprSheetSim(exported);
    },
    supportedJobs: ['RPR'],
    isDefaultSim: true
};

class RotationState {
    private _combo: number = 0;
    get combo() {
        return this._combo
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }

    oddShroudUsed: boolean = false;

    //We don't refresh SoD going into double enshroud, so we keep track of them
    // to stop refreshing after the 4th
    private _sodNumber = 0;
    get sodNumber() {
        return this._sodNumber;
    }
    set sodNumber(newSodNumber) {
        if (newSodNumber > 4) {
            newSodNumber = 1;
        }
        this._sodNumber = newSodNumber;
    }

    /** Alternate gibbet/gallows */
    nextGibGal = Actions.Gallows.id;
    gibGalSwap() {
        this.nextGibGal = (this.nextGibGal == Actions.Gallows.id) ? Actions.Gibbet.id : Actions.Gallows.id;
    }

    /** Alternates between 50 and 100.
     * Before odd gluttony, we want to save up 50 gauge at all times (meaning spend only at 100)
     * After odd gluttony, we want to get our shroud ASAP so our burst isn't delayed (meaning spend at 50)
     */
    spendSoulThreshold = 100;

    /** Keep track so we don't drop combo */
    lastComboTime: number;
}


class RprCycleProcessor extends CycleProcessor {

    rotationState: RotationState;
    gauge: RprGauge;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new RprGauge();
        this.rotationState = new RotationState();
    }

    getBuffIfActive(buff: Buff): Buff {
        return this.getActiveBuffs().find(b => b.statusId === buff.statusId);
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

    override use(ability: Ability): AbilityUseResult {
        const rprAbility = ability as RprAbility;

        if (rprAbility.updateSoulGauge != null || rprAbility.updateShroudGauge != null) {
            
            /** prevent weird gauge update if an auto lands between now and nextGcdTime */
            if (ability.type == 'gcd' &&  this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            } 

            if (rprAbility.updateSoulGauge != null) {
                rprAbility.updateSoulGauge(this.gauge);
            }

            /** If the ability updates shroud gauge and also is not our free enshroud from Ideal Host, update the gauge */
            if (rprAbility.updateShroudGauge != null
                && !(this.getBuffIfActive(IdealHost) && ability.id == Actions.Enshroud.id)) {

                rprAbility.updateShroudGauge(this.gauge);
            }
        }

        if (rprAbility === Actions.ShadowOfDeath) {
            this.rotationState.sodNumber++;
        }
    
        return super.use(ability)
    }

    override useOgcd(ability: OgcdAbility): AbilityUseResult {
        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (this.canUseWithoutClipping(ability)) {
            const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
            if (this.totalTime > readyAt) {
                this.advanceTo(readyAt);
            }
        }
        // Only try to use the Ogcd if it's ready.
        return this.cdTracker.canUse(ability) ? super.useOgcd(ability) : null;
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {

        // Add gauge data to this record for the UI
        const extraData: RprExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    useGibGal() {

        if (this.rotationState.nextGibGal == Actions.Gallows.id) {

            this.useOgcd(Actions.UnveiledGallows);
            this.useGcd(Actions.Gibbet);
        }
        else {
            this.useOgcd(Actions.UnveiledGibbet);
            this.useGcd(Actions.Gallows);

        }
    }

    useGluttonyAndExecutioners() {
        this.useOgcd(Actions.Gluttony);

        if (this.rotationState.nextGibGal == Actions.Gallows.id) {
            this.useGcd(Actions.ExecutionersGallows);
            this.useGcd(Actions.ExecutionersGibbet);
        }
        else {
            this.useGcd(Actions.ExecutionersGibbet);
            this.useGcd(Actions.ExecutionersGallows);
        }
    }

    comboActions: RprGcdAbility[] = [Actions.Slice, Actions.WaxingSlice, Actions.InfernalSlice];
    useCombo() {
        this.useGcd(this.comboActions[this.rotationState.combo++]);
        this.rotationState.lastComboTime = this.currentTime;
    }

    /** Use a basic enshroud */
    useEnshroud() {
        this.useOgcd(Actions.Enshroud);

        this.useGcd(Actions.VoidReapingUnbuffed);
        this.useOgcd(Actions.Sacrificium);

        this.useGcd(Actions.CrossReaping);
        this.useOgcd(Actions.LemuresSlice);

        this.useGcd(Actions.VoidReaping);
        this.useGcd(Actions.CrossReaping)
        this.useOgcd(Actions.LemuresSlice);

        this.useGcd(Actions.Communio);
    }

    public useOpener(pot: boolean) {

        this.useGcd(Actions.Harpe);

        this.useGcd(Actions.ShadowOfDeath);

        this.advanceForLateWeave([potionMaxStr]);
        if (pot) {
            this.useOgcd(potionMaxStr);
        }

        this.useGcd(Actions.SoulSlice);

        this.advanceForLateWeave([Actions.ArcaneCircle, Actions.Gluttony]);
        this.useOgcd(Actions.ArcaneCircle);
        this.useOgcd(Actions.Gluttony);

        this.useGcd(Actions.ExecutionersGallowsUnbuffed);
        this.useGcd(Actions.ExecutionersGibbet);
        
        this.useGcd(Actions.SoulSlice);

        this.useGcd(Actions.PlentifulHarvest);

        this.useEnshroud();
        this.useGcd(Actions.Perfectio);
    
        this.useGibGal();
        this.useGcd(Actions.ShadowOfDeath);
    }

    useStandardDoubleShroud() {
        this.useOgcd(Actions.Enshroud);

        this.useGcd(Actions.ShadowOfDeath);
        this.useGcd(Actions.VoidReapingUnbuffed);
        
        /** If we cannot weave AC here, there's a logic error in when to enshroud */
        let acTime = Math.max(this.cdTracker.statusOf(Actions.ArcaneCircle).readyAt.absolute, this.currentTime);
        const nextReaping = this.nextGcdTime + this.gcdTime(Actions.ShadowOfDeath);

        if (this.currentTime < 180) { // Hack to see if we're in first burst
            acTime = (nextReaping - animationLock(Actions.ArcaneCircle));

        }

        if (this.cdTracker.canUse(potionMaxStr)) {

            /** If we can weave potion between AC and next gcd */
            if (nextReaping - acTime >= animationLock(potionMaxStr)) {
                this.useGcd(Actions.ShadowOfDeath);
                this.useOgcd(Actions.ArcaneCircle);
                this.useOgcd(potionMaxStr);
            }
            else {
                /** If we can weave potion before AC */
                if (acTime - (this.nextGcdTime + animationLock(Actions.ShadowOfDeath)) >= animationLock(potionMaxStr)) {
                    this.useGcd(Actions.ShadowOfDeath);
                    this.useOgcd(potionMaxStr);
                    this.useOgcd(Actions.ArcaneCircle);
                }
                /** We cannot fit both pot and AC, move pot back */
                else {
                    this.useOgcd(potionMaxStr);
                    this.useGcd(Actions.ShadowOfDeath);
                    this.useOgcd(Actions.ArcaneCircle);
                }
            }
        }
        else {
            this.useGcd(Actions.ShadowOfDeath);

            if (this.currentTime < 240) { // Hacky way to single out the first burst
                this.advanceForLateWeave([Actions.ArcaneCircle]);
            }
            this.useOgcd(Actions.ArcaneCircle);
        }

        this.useGcd(Actions.CrossReaping);
        this.useOgcd(Actions.LemuresSlice);

        this.useGcd(Actions.VoidReaping);
        this.useOgcd(Actions.Sacrificium);

        this.useGcd(Actions.CrossReaping);
        this.useOgcd(Actions.LemuresSlice);

        this.useGcd(Actions.Communio);

        this.useGcd(Actions.PlentifulHarvest);

        this.useEnshroud();

        /** if combo is gonna break we need to continue it */
        if (this.rotationState.lastComboTime + 30 < this.nextGcdTime + this.stats.gcdPhys(2.5) && this.rotationState.combo != 0) {
            this.useCombo();
            this.useGcd(Actions.Perfectio);
        }
        else{
            this.useGcd(Actions.Perfectio);

            if (this.rotationState.combo != 0) {
                this.useCombo();
            }
        }

        /** Use combos and soulslice until gluttony is possible */
        while (this.remainingGcdTime > 0 && (this.gauge.soulGauge < 50 || !this.canUseWithoutClipping(Actions.Gluttony))) {
            if (this.cdTracker.canUse(Actions.SoulSlice, this.nextGcdTime) && this.gauge.soulGauge <= 50) {

                this.useGcd(Actions.SoulSlice);
            }
            else {
                this.useCombo();
            }
        }

        while (!this.canUseWithoutClipping(Actions.Gluttony) && this.remainingGcdTime > 0) {
            this.useCombo();
        }
        this.useGluttonyAndExecutioners();

        /** set rotation state to pre-odd-shroud-and-gluttony */
        this.rotationState.spendSoulThreshold = 100;
        this.rotationState.oddShroudUsed = false;
        
    }

    useFiller() {

        /** Use gluttony
        * This assumes that if we can weave gluttony, it can be the only weave.
        * If that's not the case then this needs to be revisited
        */
        if (this.canUseWithoutClipping(Actions.Gluttony)
        && this.gauge.soulGauge >= 50) {
            this.useGluttonyAndExecutioners();

            /** Alternate spend soul threshold between 50 and 100 each gluttony usage. */
            this.rotationState.spendSoulThreshold = 50;
            return;
        }

        // use odd enshroud at some point when available
        const ddStatus = this.getActiveBuffData(DeathsDesign);
        if (this.gauge.shroudGauge >= 50
            && !this.rotationState.oddShroudUsed
            && this.cdTracker.statusOf(Actions.Gluttony).readyAt.relative > 8.5 + this.stats.gcdPhys(this.gcdBase)
            && ddStatus && ddStatus.end - this.currentTime > 11) {

            this.useEnshroud();
            this.rotationState.oddShroudUsed = true;
            return;
        }

        /** If SS is available the gcd after next one, use unveiled > gibgal to not overcap */
        if (this.cdTracker.statusOf(Actions.SoulSlice).readyAt.absolute <= this.nextGcdTime + this.stats.gcdPhys(this.gcdBase)
            && this.gauge.soulGauge >= 50
            && this.cdTracker.statusOf(Actions.Gluttony).readyAt.absolute > this.nextGcdTime + 2*this.stats.gcdPhys(this.gcdBase)) {

            this.useGibGal();
            return;
        }

        /** Use SS if its off cd and won't overcap */
        if (this.cdTracker.canUse(Actions.SoulSlice, this.nextGcdTime)
            && this.gauge.soulGauge <= 50) {
            
            this.useGcd(Actions.SoulSlice);
            return;
        }

        /** Use SoD if it wont overcap and we're not heading into burst */
        if (
            (!ddStatus || (ddStatus.end - this.currentTime + DeathsDesign.duration < DeathsDesign.maxStackingDuration
            && this.rotationState.sodNumber <= 3))
        ) {
            this.useGcd(Actions.ShadowOfDeath);
            return;
        }

        /** Spend soul if we're at the threshold */
        if (this.gauge.soulGauge >= this.rotationState.spendSoulThreshold
            && (this.gauge.shroudGauge < 50 || this.gauge.soulGauge == 100) //Only spend up to 50 shroud, unless we're going to overcap
        ) {
            this.useGibGal();
            return;
        }

        this.useCombo();
    }

}
export class RprSheetSim extends BaseMultiCycleSim<RprSheetSimResult, RprSimSettings> {

    spec = rprSheetSpec;
    shortName = "rpr-sheet-sim";
    displayName = rprSheetSpec.displayName;
    manuallyActivatedBuffs = [ArcaneCircleBuff];

    constructor(settings?: RprSimSettingsExternal) {
        super('RPR', settings);
    }

    makeDefaultSettings(): RprSimSettings {
        return {};
    }

    protected createCycleProcessor(settings: MultiCycleSettings): RprCycleProcessor {
        return new RprCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    getRotationsToSimulate(): Rotation<RprCycleProcessor>[] {

        return [{
            cycleTime: 120,

            apply(cp: RprCycleProcessor) {

                const numPots = Math.ceil(cp.remainingTime / 360) // Force pots during 2mins
                const maxAllowableDelay = cp.remainingTime - ((numPots- 1) * 360)
                const potOpener = maxAllowableDelay <= 120;

                const enshroudTime = cp.gcdTime(Actions.CrossReaping) + 3 * cp.gcdTime(Actions.ShadowOfDeath) - animationLock(Actions.ArcaneCircle);
                const gcdAnimLock = animationLock(Actions.Slice);

                cp.useOpener(potOpener);

                while (cp.remainingGcdTime > 0) {

                    while (cp.remainingGcdTime > 0 &&
                        (cp.cdTracker.statusOf(Actions.ArcaneCircle).readyAt.relative > enshroudTime - gcdAnimLock
                        || cp.gauge.shroudGauge < 50)){

                        cp.useFiller();
                    }

                    if (cp.remainingGcdTime > 0) {
                        cp.useStandardDoubleShroud();
                    }   
                }
            }

        }]
    }
} 