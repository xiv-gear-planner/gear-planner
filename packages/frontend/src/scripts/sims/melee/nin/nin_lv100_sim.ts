import {Ability, OgcdAbility, Buff, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, AbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {BaseMultiCycleSim} from "../../sim_processors";
import {AbilitiesUsedTable} from "../../components/ability_used_table";
import {gemdraught1dex} from "@xivgear/core/sims/common/potion";
import {Dokumori} from "@xivgear/core/sims/buffs";
import NINGauge from "./nin_gauge";
import {NinAbility, NinGcdAbility, MudraStep, NinjutsuAbility, isNinkiAbility, NINExtraData} from "./nin_types";
import * as Actions from './nin_actions';
import * as Buffs from './nin_buffs';

export interface NinSimResult extends CycleSimResult {

}

export interface NinSettings extends SimSettings {

}

export interface NinSettingsExternal extends ExternalCycleSettings<NinSettings> {

}

export const ninSpec: SimSpec<NinSim, NinSettingsExternal> = {
    stub: "nin-sim-lv100",
    displayName: "NIN Sim",
    makeNewSimInstance: function (): NinSim {
        return new NinSim();
    },
    loadSavedSimInstance: function (exported: NinSettingsExternal) {
        return new NinSim(exported);
    },
    supportedJobs: ['NIN'],
    supportedLevels: [100],
    isDefaultSim: true
};

class RotationState {
    private _combo: number = 0;
    get combo() {
        return this._combo
    }
    set combo(newCombo: number) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }
}

class NINCycleProcessor extends CycleProcessor {
    rotationState: RotationState;
    gauge: NINGauge;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new NINGauge(settings.stats.level);
        this.rotationState = new RotationState();
    }

    getBuffIfActive(buff: Buff) {
        return this.getActiveBuffs().find(b => b.name === buff.name);
    }

    override activateBuffWithDelay(buff: Buff, delay: number) {
        // For buffs with stacks, update the stack counter instead of adding a new buff
        if (buff.selfOnly && buff.stacks && this.getBuffIfActive(buff)) {
            return;
        }

        super.activateBuffWithDelay(buff, delay);
    }

    override addAbilityUse(usedAbility: AbilityUseRecordUnf) {
        const extraData: NINExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: AbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    override use(ability: Ability): AbilityUseResult {
        const ninAbility = ability as NinAbility;

        // Update gauge from the ability itself
        if (ninAbility.updateGauge !== undefined) {
            // Prevent gauge updates showing incorrectly on autos before this ability
            if (ability.type === 'gcd' && this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            }
            ninAbility.updateGauge(this.gauge);
        }

        // Update gauge from Bunshin
        if (this.getBuffIfActive(Buffs.BunshinBuff) && ability.attackType === 'Weaponskill' && ability.id !== Actions.Phantom.id) {
            this.gauge.ninkiGauge += 5;
        }

        // Apply Kazematoi
        let modified = ability;
        if (modified.id === Actions.AeolianEdge.id && this.gauge.kazematoi > 0) {
            modified = {
                ...modified,
                potency: modified.potency + 60,
            }
        }

        return super.use(modified);
    }

    useCombo(forceAeolian?: boolean) {
        let fillerAction: NinGcdAbility;
        if (this.getBuffIfActive(Buffs.RaijuReady)) {
            fillerAction = Actions.Raiju;
        } else {
            fillerAction = Actions.SpinningEdge;
            switch (this.rotationState.combo) {
                case 1: {
                    fillerAction = Actions.GustSlash;
                    break;
                }
                case 2: {
                    if (this.gauge.kazematoi <= 3 && !forceAeolian) {
                        fillerAction = Actions.ArmorCrush;
                    } else {
                        fillerAction = Actions.AeolianEdge;
                    }
                    break;
                }
            }
            this.rotationState.combo++;
        }

        this.useGcd(fillerAction);
    }

    useMudra(step: MudraStep, useCharge?: boolean) {
        if (useCharge) {
            this.useGcd(step);
        } else {
            const modified: MudraStep = {
                ...step,
                id: step.noChargeId,
                cooldown: undefined,
            };
            this.useGcd(modified);
        }
    }

    useNinjutsu(action: NinjutsuAbility) {
        // Use the Mudra combination
        for (let i = 0; i < action.steps.length; i++) {
            // Only consume charges on the first step and if we don't have kassatsu
            const useCharge = i === 0 && !this.getBuffIfActive(Buffs.KassatsuBuff)
            this.useMudra(action.steps[i], useCharge);
        }

        // Use the Ninjutsu
        this.useGcd(action);
    }

    useTCJ() {
        this.useOgcd(Actions.TenChiJin);
        if (this.nextGcdTime <= this.totalTime) {
            this.advanceTo(this.nextGcdTime, true);
        }
        this.useGcd({
            ...Actions.Fuma,
            animationLock: 0,
        });
        if (this.nextGcdTime <= this.totalTime) {
            this.advanceTo(this.nextGcdTime, true);
        }
        this.useGcd({
            ...Actions.Raiton,
            animationLock: 0,
        });
        if (this.nextGcdTime <= this.totalTime) {
            this.advanceTo(this.nextGcdTime, true);
        }
        this.useGcd(Actions.Suiton);
    }

    usePhantom() {
        if (this.getBuffIfActive(Buffs.PhantomReady)) {
            this.useGcd(Actions.Phantom);
        }
    }

    useNinki() {
        if (this.gauge.ninkiReady()) {
            let action = Actions.Bhavacakra;
            if (this.getBuffIfActive(Buffs.Higi)) {
                action = Actions.ZeshoMeppo;
            } else if (this.cdTracker.canUse(Actions.Bunshin)) {
                action = Actions.Bunshin;
            }
            this.useOgcd(action);
        }
    }

    useOgcdIfReady(action: OgcdAbility, counter: number, maxCount: number): number {
        if (counter < maxCount && this.cdTracker.canUse(action)) {
            if (isNinkiAbility(action)) {
                this.useNinki();
            } else {
                this.useOgcd(action);
            }
            counter++;
        }
        return counter;
    }

    useFillerOgcd(maxCount?: number, ninkiGaugeOverride?: number): number {
        // TODO: Use some kind of helper method to determine if an ogcd can be used without clipping instead
        let oGcdCount = 0;
        const maxOgcdCount = maxCount ?? 2;
        const ninkiGaugeCap = ninkiGaugeOverride ?? 85;

        // Spend Ninki before overcapping
        if (this.gauge.ninkiGauge >= ninkiGaugeCap) {
            oGcdCount = this.useOgcdIfReady(Actions.Bunshin, oGcdCount, maxOgcdCount);
            oGcdCount = this.useOgcdIfReady(Actions.Bhavacakra, oGcdCount, maxOgcdCount);
        }

        // Use Kassatsu, but only in preparation for trick
        if (this.getBuffIfActive(Buffs.ShadowWalker)) {
            oGcdCount = this.useOgcdIfReady(Actions.Kassatsu, oGcdCount, maxOgcdCount);
        }

        return oGcdCount;
    }

    useFillerGcd() {
        if (this.getBuffIfActive(Buffs.PhantomReady)) {
            this.usePhantom();
        } else {
            this.useCombo();
        }
    }

    useOpener() {
        this.useNinjutsu(Actions.Suiton);
        this.useOgcd(Actions.Kassatsu);

        this.useCombo();
        this.useOgcd(gemdraught1dex);

        this.useCombo();
        this.useOgcd(Actions.DokumoriAbility);
        this.useOgcd(Actions.Bunshin);

        this.usePhantom();

        this.useCombo();
        this.useOgcd(Actions.KunaisBane);

        this.useNinjutsu(Actions.Hyosho);
        this.useOgcd(Actions.DreamWithin);

        this.useNinjutsu(Actions.Raiton);

        this.useTCJ();
        this.useOgcd(Actions.Meisui);

        this.useCombo();
        this.useNinki();
        this.useOgcd(Actions.TenriJindo);

        this.useCombo();
        this.useNinki();

        this.useNinjutsu(Actions.Raiton);

        this.useCombo();
    }

    useOddMinBurst() {
        this.useOgcd(Actions.KunaisBane);

        this.useCombo(true);
        this.useOgcd(Actions.DreamWithin);

        this.useNinjutsu(Actions.Hyosho);
        this.useFillerOgcd(1, 50);

        this.useNinjutsu(Actions.Raiton);
        this.useFillerOgcd(1, 50);

        this.useCombo(true);
        this.useFillerOgcd(2, 50);

        this.useNinjutsu(Actions.Raiton);
        this.useFillerOgcd(1, 50);

        this.useCombo(true);
        this.useFillerOgcd(2, 50);

        this.useCombo(true);
    }

    useEvenMinBurst() {
        this.useOgcd(Actions.DokumoriAbility);

        this.useFillerGcd();
        this.useOgcd(Actions.KunaisBane);

        this.useNinjutsu(Actions.Hyosho);
        this.useOgcd(Actions.DreamWithin);

        this.useNinjutsu(Actions.Raiton);
        this.useFillerOgcd(1, 50);

        this.useTCJ();
        this.useFillerOgcd(1, 50);

        this.useCombo(true);
        this.useOgcd(Actions.Meisui);
        this.useFillerOgcd(1, 50);

        this.useCombo(true);
        this.useOgcd(Actions.TenriJindo);
        this.useFillerOgcd(1, 50);

        this.useNinjutsu(Actions.Raiton);
        this.useFillerOgcd(1, 50);

        this.useCombo(true);
    }
}

export class NinSim extends BaseMultiCycleSim<NinSimResult, NinSettings, NINCycleProcessor> {
    spec = ninSpec;
    shortName = "nin-sim-lv100";
    displayName = ninSpec.displayName;
    manuallyActivatedBuffs = [Dokumori];
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: 6 * 60,
        cycles: 0, // ???
        which: 'totalTime' // ??????
    }

    constructor(settings?: NinSettingsExternal) {
        super('NIN', settings);
    }

    makeDefaultSettings(): NinSettings {
        return {};
    }

    override makeAbilityUsedTable(result: NinSimResult): AbilitiesUsedTable {
        const extraColumns = NINGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

    protected createCycleProcessor(settings: MultiCycleSettings): NINCycleProcessor {
        return new NINCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    getRotationsToSimulate(): Rotation<NINCycleProcessor>[] {
        return [{
            cycleTime: 6 * 60,
            apply(cp: NINCycleProcessor) {
                cp.useOpener();

                cp.remainingCycles(() => {
                    while (cp.cdTracker.statusOf(Actions.KunaisBane).readyAt.relative > 20 || !cp.cdTracker.canUse(Actions.Ten)) {
                        cp.useFillerGcd();
                        cp.useFillerOgcd();
                        if (cp.remainingGcdTime <= 0) {
                            return;
                        }
                    }

                    cp.useNinjutsu(Actions.Suiton);

                    cp.useFillerGcd();
                    while (!cp.canUseWithoutClipping(Actions.KunaisBane)) {
                        cp.useFillerOgcd();
                        cp.useFillerGcd();
                        if (cp.remainingGcdTime <= 0) {
                            return;
                        }
                    }

                    cp.advanceTo(cp.nextGcdTime - (Actions.KunaisBane.animationLock ?? STANDARD_ANIMATION_LOCK));
                    cp.useOddMinBurst();

                    while (cp.cdTracker.statusOf(Actions.KunaisBane).readyAt.relative > 20 || !cp.cdTracker.canUse(Actions.Ten)) {
                        cp.useFillerGcd();
                        cp.useFillerOgcd();
                        if (cp.remainingGcdTime <= 0) {
                            return;
                        }
                    }

                    cp.useNinjutsu(Actions.Suiton);

                    cp.useFillerGcd();
                    while (!(cp.canUseWithoutClipping(Actions.DokumoriAbility) && cp.canUseWithoutClipping(Actions.KunaisBane))) {
                        cp.useFillerOgcd();
                        cp.useFillerGcd();
                        if (cp.remainingGcdTime <= 0) {
                            return;
                        }
                    }

                    cp.advanceTo(cp.nextGcdTime - (Actions.DokumoriAbility.animationLock ?? STANDARD_ANIMATION_LOCK));
                    cp.useEvenMinBurst();
                });
            }
        }]
    }
} 