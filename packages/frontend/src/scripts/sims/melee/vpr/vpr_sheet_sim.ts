import { AbilityUseRecordUnf, AbilityUseResult, CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation } from "@xivgear/core/sims/cycle_sim";
import { Ability, Buff, OgcdAbility, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { BaseMultiCycleSim } from "../../sim_processors";
import { VprGauge } from "./vpr_gauge";
import { VprAbility, VprExtraData, VprGcdAbility } from "./vpr_types";
import * as Actions from "./vpr_actions";
import { FlanksbaneVenom, FlankstungVenom, HindsbaneVenom, HindstungVenom, HuntersInstinct, NoxiousGnash, ReadyToReawaken, Swiftscaled } from "./vpr_buffs";
import { gemdraught1dex } from "@xivgear/core/sims/common/potion";
import { sum } from "@xivgear/core/util/array_utils";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { AbilitiesUsedTable } from "../../components/ability_used_table";

export interface VprSimResult extends CycleSimResult {
}

export interface VprNewSheetSettings extends SimSettings {

}

export interface VprNewSheetSettingsExternal extends ExternalCycleSettings<VprNewSheetSettings> {
}


export const vprSheetSpec: SimSpec<VprSheetSim, VprNewSheetSettingsExternal> = {
    stub: "vpr-sheet-sim",
    displayName: "VPR Sim",
    makeNewSimInstance: function (): VprSheetSim {
        return new VprSheetSim();
    },
    loadSavedSimInstance: function (exported: VprNewSheetSettingsExternal) {
        return new VprSheetSim(exported);
    },
    supportedJobs: ['VPR'],
    isDefaultSim: true
};

class RotationState {
    private _comboStep: number = 0;
    get comboStep() {
        return this._comboStep;
    }
    set comboStep(newCombo: number) {
        this._comboStep = newCombo % 3;
    }
    private _next2ndGcd: number = 0;
    get next2ndGcd() {
        return this._next2ndGcd
    }
    set next2ndGcd(new2ndGcd: number) {
        this._next2ndGcd = new2ndGcd % 2;
    }

    public numDreadwindersUsed: number = 0;
    public forceDreadFangs: boolean = false;
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

    override addAbilityUse(usedAbility: AbilityUseRecordUnf) {

        // Add gauge data to this record for the UI
        const extraData: VprExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: AbilityUseRecordUnf = {
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
            if (ability.type == 'gcd' &&  this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            } 

            /** Don't update gauge if we are awakening and ready to reawaken */
            if ( !(vprAbility.id == Actions.Reawaken.id && this.getBuffIfActive(ReadyToReawaken)) ) {
                vprAbility.updateGauge(this.gauge);
            }
        }

        if (vprAbility.id == Actions.FlanksbaneFang.id
            || vprAbility.id == Actions.FlankstingStrike.id
            || vprAbility.id == Actions.HindsbaneFang.id
            || vprAbility.id == Actions.HindstingStrike.id
        ) {
            this.rotationState.lastDualWieldFinisher = vprAbility as VprGcdAbility;
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
        this.useGcd(Actions.Dreadwinder);
        this.rotationState.numDreadwindersUsed += 1;
    }

    useDreadWinderCombo() {
        this.useDreadWinder();

        if (this.getActiveBuffData(HuntersInstinct) == null) {
            console.warn("No Hunter's Instinct when starting Dreadwinder Combo!");
        }
        if (this.getActiveBuffData(Swiftscaled) == null) {
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

    secondComboGcds: VprGcdAbility[] = [Actions.SwiftskinsSting, Actions.HuntersSting];
    public useDualWieldCombo() {
        const buff = this.getActiveBuffData(NoxiousGnash);
        switch (this.rotationState.comboStep) {
            case 0:
                if (!buff
                    || this.rotationState.forceDreadFangs
                    || buff.end - this.currentTime < 20) {

                    this.useGcd(Actions.DreadFangs);

                    if (this.rotationState.forceDreadFangs) { // If we need to force dread fangs even if it will overcap
                        this.rotationState.forceDreadFangs = false;
                    }
                }
                else {
                    this.useGcd(Actions.SteelFangs);
                }
                break;
            case 1:
                this.useGcd(this.secondComboGcds[this.rotationState.next2ndGcd]);
                this.rotationState.next2ndGcd += 1;
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
                    this.useGcd(Actions.FlanksbaneFang)
                }
                else if (this.getBuffIfActive(FlankstungVenom)) {
                    this.useGcd(Actions.FlankstingStrike);
                }
                else { // No buff running; Pick arbitrarily based on previous 2nd combo

                    /** If we just used Hunter's sting */
                    if (this.rotationState.next2ndGcd == 0) {
                        this.useGcd(Actions.HindsbaneFang); // Chosen arbitrarily from the flank options
                    }
                    /** If we just used Swiftskin's sting */
                    else if (this.rotationState.next2ndGcd == 1) {
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
         * - need to not drop NG (TODO: check if H. instinct or swiftscaled need to be checked)
        */
        const comboBreakTime = this.rotationState.lastComboTime + 30;
        const gcdAfterUF = this.nextGcdTime + this.gcdTime(Actions.UncoiledFury);
        let numCombosNeeded = 2 - this.rotationState.comboStep + 1;
        const nextFinisher = gcdAfterUF + numCombosNeeded * this.gcdTime(Actions.DreadFangs);
        const nextNGRefresh = this.rotationState.comboStep == 0 ? gcdAfterUF : gcdAfterUF + nextFinisher + this.gcdTime(Actions.DreadFangs)

        if (gcdAfterUF < comboBreakTime // if the gcd after has time to continue combo
            && this.getActiveBuffData(NoxiousGnash).end > nextNGRefresh
            && this.getActiveBuffData(this.rotationState.lastDualWieldFinisher.activatesBuffs[0]).end > nextFinisher) {

            this.useUncoiledFury();
        }

        /** Use combo till we're good with finisher
         * Note: always > 0 */
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
        this.useGcd(Actions.Dreadwinder);

        this.advanceForLateWeave([gemdraught1dex]);
        this.useOgcd(gemdraught1dex)

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
        const gcdTime = this.gcdTime(Actions.DreadFangs); // We already have a rule not to use non-dualwield gcds, so we can be assured that this is accurate. 

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

        const gcdTime = this.gcdTime(Actions.DreadFangs); // We already have a rule not to use non-dualwield gcds, so we can be assured that this is accurate. 
        const gcdAfterSerpentsIre = this.getGcdTimeAfterSerpentsIre();
        const reawakenStart = gcdAfterSerpentsIre + gcdTime;

        return Math.abs(reawakenStart - this.nextGcdTime - 3 * gcdTime) < 0.0001;
    }

    canUseReawaken(): boolean {
        const numTwinbladeCombosToUse = 3 - this.rotationState.numDreadwindersUsed;
        const numRattlingCoils = this.gauge.rattlingCoils + numTwinbladeCombosToUse + 1; // +1 for Serpent's ire
        const numUFs = numRattlingCoils;

        /** We're going to so some pre-simulation to determine gauge at 2mins. */
        let currOfferings = this.gauge.serpentOfferings - 50;
        let currTime = this.nextGcdTime; 

        /** We are going to shift the GCDs around to make math easier.
         * Pretend we are starting after all of (hypothetical reawaken, UFs, Twinblade Combos) have been used, immediately.
         * That means the rest of the gcds before 2min reawaken are *all* dual wield combos. 
        */
        const UFGcd = this.gcdTime(Actions.UncoiledFury);
        const dualWieldGcd = this.gcdTime(Actions.DreadFangs);
        currTime += numUFs * UFGcd
                    + 3 * numTwinbladeCombosToUse * this.gcdTime(Actions.Dreadwinder)
                    + this.getReawakenDuration();

        currOfferings += 10 * numTwinbladeCombosToUse;

        const nextBurstStart = this.getGcdTimeAfterSerpentsIre() + 3 * dualWieldGcd;
        let numFinishersBeforeBurst = 0;

        /** Advance to our next combo-neutral spot, to make counting easier. */
        let combo = this.rotationState.comboStep;
        if (combo != 0) {
            while (combo != 0) {
                currTime += dualWieldGcd;
                combo = (combo + 1) % 3
            }
            numFinishersBeforeBurst += 1;
        }

        const numGcdsBeforeBurst = Math.floor((nextBurstStart - currTime) / this.gcdTime(Actions.DreadFangs));
        numFinishersBeforeBurst += Math.floor(numGcdsBeforeBurst / 3)

        currOfferings += 10 * numFinishersBeforeBurst;
        
        return currOfferings >= 50;
    }

    rotationStep() {

        if (this.canUseWithoutClipping(Actions.SerpentsIre)) {
            this.useOgcd(Actions.SerpentsIre);
            this.useDualWieldCombo();
            this.useDoubleReawaken();
            return;
        }

        /** Pre-burst logic */
        if (this.cdTracker.statusOf(Actions.SerpentsIre).readyAt.absolute - this.nextGcdTime < 10) {
            if (this.isImmediatelyBeforeBurst()) {
                
                const reawakenTime = this.nextGcdTime + 3*this.gcdTime(Actions.DreadFangs);

                /** Since the full duration of ouroboros is used, this time is the start of the GCD after */
                if (reawakenTime + 2 * this.getReawakenDuration() > this.getActiveBuffData(NoxiousGnash)!.end) {

                    this.rotationState.forceDreadFangs = true;
                }
            }

            this.useDualWieldCombo();
            if (this.canUseWithoutClipping(gemdraught1dex)) {
                this.advanceForLateWeave([gemdraught1dex]);
                this.useOgcd(gemdraught1dex);
            }

            return;
        }


        if (this.cdTracker.canUse(Actions.Dreadwinder)
            && this.getActiveBuffData(NoxiousGnash).end - this.nextGcdTime < NoxiousGnash.duration
            && this.gauge.serpentOfferings + 10 <= 100
            && this.cdTracker.statusOfAt(Actions.SerpentsIre, this.nextGcdTime).readyAt.relative > 10) {
        
            if (this.gauge.rattlingCoils == 3) {
                this.useUncoiledFury();
                this.useDreadWinderCombo();
                return;
            }
            else {
                this.useDreadWinderCombo();
                return;
            }
        }

        if (this.gauge.serpentOfferings >= 50
            && this.nextGcdTime + this.getReawakenDuration() < this.getActiveBuffData(NoxiousGnash).end
            && this.canUseReawaken()) {
            
            this.useReawaken();
            return;
        }

        if (this.gauge.rattlingCoils > 0) {
            this.useUncoiledFury();
        }


        this.useDualWieldCombo();
    }
}

export class VprSheetSim extends BaseMultiCycleSim<VprSimResult, VprNewSheetSettings> {

    spec = vprSheetSpec;
    shortName = "vpr-sheet-sim";
    displayName = vprSheetSpec.displayName;

    constructor(settings?: VprNewSheetSettingsExternal) {
        super('VPR', settings);
    }

    makeDefaultSettings(): VprNewSheetSettings {
        return {};
    }

    override makeAbilityUsedTable(result: VprSimResult): AbilitiesUsedTable {
        const extraColumns = VprGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
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
            }
        }];
    }
}