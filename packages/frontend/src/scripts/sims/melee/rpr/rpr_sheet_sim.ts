import {ArcaneCircleBuff} from "@xivgear/core/sims/buffs";
import {Ability, Buff, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {AbilityUseRecordUnf, AbilityUseResult, CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../../sim_processors";
import * as Actions from "./rpr_actions"
import { RprAbility, RprExtraData, RprGcdAbility } from "./rpr_types";
import { RprGauge } from "./rpr_gauge";
import { DeathsDesign, IdealHost } from "./rpr_buff";
import { AbilitiesUsedTable } from "../../components/ability_used_table";


export interface RprSheetSimResult extends CycleSimResult {
}

export interface RprNewSheetSettings extends SimSettings {

}

export interface RprNewSheetSettingsExternal extends ExternalCycleSettings<RprNewSheetSettings> {
}


export const rprSheetSpec: SimSpec<RprSheetSim, RprNewSheetSettingsExternal> = {
    stub: "rpr-sheet-sim",
    displayName: "RPR Sim",
    makeNewSimInstance: function (): RprSheetSim {
        return new RprSheetSim();
    },
    loadSavedSimInstance: function (exported: RprNewSheetSettingsExternal) {
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
     * Before odd gluttony, we want to save up 50 gauge at all time (meaning spend only at 100)
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

    override addAbilityUse(usedAbility: AbilityUseRecordUnf) {

        // Add gauge data to this record for the UI
        const extraData: RprExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: AbilityUseRecordUnf = {
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

    public useOpener() {

        const canUsePHWithoutClip = this.stats.gcdPhys(2.5) > 2.47;

        this.useGcd(Actions.Harpe);

        this.useGcd(Actions.ShadowOfDeath);

        this.useGcd(Actions.SoulSlice);
        this.useOgcd(Actions.ArcaneCircle);
        this.useOgcd(Actions.Gluttony);

        this.useGcd(Actions.ExecutionersGallowsUnbuffed);
        this.useGcd(Actions.ExecutionersGibbet);
        
        /** Adjust opener if PH can't be used without clipping. */
        if (!canUsePHWithoutClip){
            this.useGcd(Actions.SoulSlice);
        }

        this.useGcd(Actions.PlentifulHarvest);

        this.useEnshroud();
        this.useGcd(Actions.Perfectio);
    
        if (canUsePHWithoutClip) {
            this.useGcd(Actions.SoulSlice);
        }

        this.useGibGal();
        this.useGcd(Actions.ShadowOfDeath);
    }

    useStandardDoubleShroud() {
        this.useOgcd(Actions.Enshroud);

        this.useGcd(Actions.ShadowOfDeath);
        this.useGcd(Actions.VoidReapingUnbuffed);
        this.useGcd(Actions.ShadowOfDeath);
        
        this.useOgcd(Actions.ArcaneCircle);

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
        if (this.rotationState.lastComboTime + 30 < this.nextGcdTime + this.stats.gcdPhys(2.5)) {
            this.useCombo();
            this.useGcd(Actions.Perfectio);
        }
        else{
            this.useGcd(Actions.Perfectio);
            this.useCombo();
        }

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
            this.rotationState.spendSoulThreshold = 150 - this.rotationState.spendSoulThreshold; 
            return;
        }

        // use odd enshroud at some point when available
        const ddStatus = this.getActiveBuffData(DeathsDesign);
        if (this.gauge.shroudGauge >= 50
            && !this.rotationState.oddShroudUsed
            && this.cdTracker.statusOf(Actions.Gluttony).readyAt.relative > 8.5 + this.stats.gcdPhys(this.gcdBase)
            && ddStatus && ddStatus.end - this.currentTime > 11) {

            this.useEnshroud();
            this.getActiveBuffData(DeathsDesign);
            this.rotationState.oddShroudUsed = true;
            return;
        }

        /** If SS is available the gcd after next one, use unveiled > gibgal to not overcap */
        if (this.cdTracker.statusOf(Actions.SoulSlice).readyAt.absolute <= this.nextGcdTime + this.stats.gcdPhys(this.gcdBase) &&
            this.gauge.soulGauge >= 50) {

            this.useGibGal();
            return;
        }

        /** Use SS if its off cd */
        if (this.cdTracker.canUse(Actions.SoulSlice)
            && this.gauge.soulGauge <= 50) {
            
            this.useGcd(Actions.SoulSlice);
            return;
        }

        /** Use SoD if it wont overcap and we're not heading into burst */
        if (
            (ddStatus.end - this.currentTime + DeathsDesign.duration < DeathsDesign.maxStackingDuration
            && this.rotationState.sodNumber <= 3)
        ) {
            this.useGcd(Actions.ShadowOfDeath);
            return;
        }

        /** Spend soul if we're at the threshold */
        if (this.gauge.soulGauge >= this.rotationState.spendSoulThreshold) {
            this.useGibGal();
            return;
        }

        this.useCombo();
    }

}
export class RprSheetSim extends BaseMultiCycleSim<RprSheetSimResult, RprNewSheetSettings> {

    spec = rprSheetSpec;
    shortName = "rpr-sheet-sim";
    displayName = rprSheetSpec.displayName;
    manuallyActivatedBuffs = [ArcaneCircleBuff];

    rotationState: RotationState = new RotationState();
    readonly comboActions: GcdAbility[] = [Actions.Slice, Actions.WaxingSlice, Actions.InfernalSlice];

    constructor(settings?: RprNewSheetSettingsExternal) {
        super('RPR', settings);
    }

    makeDefaultSettings(): RprNewSheetSettings {
        return {};
    }

    override makeAbilityUsedTable(result: RprSheetSimResult): AbilitiesUsedTable {
        const extraColumns = RprGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

    protected createCycleProcessor(settings: MultiCycleSettings): RprCycleProcessor {
        return new RprCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    getRotationsToSimulate(): Rotation<RprCycleProcessor>[] {
        this.rotationState = new RotationState();
        return [{
            cycleTime: 120,

            apply(cp: RprCycleProcessor) {

                cp.useOpener();

                /* 7.2 is the sum of all gcd times between the gcd before enshroud and when AC is pressed */
                while (cp.remainingGcdTime > 0 &&
                    (cp.cdTracker.statusOf(Actions.ArcaneCircle).readyAt.relative > 7.2 )) {

                    cp.useFiller();
                }

                while (cp.remainingGcdTime > 0) {
                    cp.useStandardDoubleShroud();

                    while (cp.remainingGcdTime > 0 &&
                        (cp.cdTracker.statusOf(Actions.ArcaneCircle).readyAt.relative > 7.2 
                        || cp.gauge.shroudGauge < 50)){

                        cp.useFiller();
                    }
                }
            }

        }]
    }
} 