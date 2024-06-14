import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../../sim_processors";
import {Dokumori} from "@xivgear/core/sims/buffs";
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
    };
    set combo(newCombo: number) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }

    private _ninkiGauge: number = 0;
    get ninkiGauge() {
        return this._ninkiGauge;
    }
    set ninkiGauge(newGauge: number) {
        this._ninkiGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    spendNinki() {
        this.ninkiGauge -= 50;
    }

    private _kazematoi: number = 0;
    get kazematoi() {
        return this._kazematoi;
    }
    set kazematoi(newGauge: number) {
        this._kazematoi = Math.max(Math.min(newGauge, 5), 0);
    }

    spendKazematoi() {
        this.kazematoi -= 1;
    }

    grantKazematoi() {
        this.kazematoi += 2;
    }

    private _raijuStacks: number = 0;
    get raijuStacks() {
        return this._raijuStacks;
    }
    set raijuStacks(newStacks: number) {
        this._raijuStacks = Math.max(Math.min(newStacks, 3), 0);
    }

    raijuReady() {
        return this.raijuStacks > 0;
    }
}

export class NinSim extends BaseMultiCycleSim<NinSimResult, NinSettings> {
    spec = ninSpec;
    shortName = "nin-sim-lv100";
    displayName = ninSpec.displayName;
    manuallyActivatedBuffs = [Dokumori];

    rotationState: RotationState = new RotationState();

    constructor(settings?: NinSettingsExternal) {
        super('NIN', settings);
    }

    makeDefaultSettings(): NinSettings {
        return {};
    }

    useCombo(cp: CycleProcessor, forceAeolian?: boolean) {
        this.rotationState.combo++;
        this.rotationState.ninkiGauge += 5;
        let fillerAction: GcdAbility = Actions.SpinningEdge;
        switch (this.rotationState.combo) {
            case 1: {
                fillerAction = Actions.GustSlash;
                break;
            }
            case 2: {
                this.rotationState.ninkiGauge += 10;
                if (this.rotationState.kazematoi <= 3 && !forceAeolian) {
                    fillerAction = Actions.ArmorCrush;
                    this.rotationState.grantKazematoi();
                } else {
                    fillerAction = Actions.AeolianEdge;
                    this.rotationState.spendKazematoi();
                }
                break;
            }
        }
        cp.useGcd(fillerAction);
    }

    useRaiton(cp: CycleProcessor) {
        cp.useGcd(Actions.MudraStart);
        cp.useGcd(Actions.MudraFollowup);
        cp.useGcd(Actions.Raiton);
        this.rotationState.raijuStacks++;
    }

    useSuiton(cp: CycleProcessor) {
        cp.useGcd(Actions.MudraStart);
        cp.useGcd(Actions.MudraFollowup);
        cp.useGcd(Actions.MudraFollowup);
        cp.useGcd(Actions.Suiton);
    }

    useTCJ(cp: CycleProcessor) {
        cp.useOgcd(Actions.TenChiJin);
        cp.useGcd(Actions.Fuma);
        cp.useGcd(Actions.Raiton);
        this.rotationState.raijuStacks++;
        cp.useGcd(Actions.Suiton);
    }

    useRaiju(cp: CycleProcessor) {
        if (this.rotationState.raijuReady()) {
            cp.useGcd(Actions.Raiju);
            this.rotationState.raijuStacks--;
        }
    }

    useOpener(cp: CycleProcessor) {

    }

    useOddMinBurst(cp: CycleProcessor) {

    }

    useEvenMinBurst(cp: CycleProcessor) {

    }

    useFillerOgcd(cp: CycleProcessor) {
        // TODO: Determine what ogcds should be used, if any
    }

    getRotationsToSimulate(): Rotation[] {
        const sim = this;
        this.rotationState = new RotationState();
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {

            }
        }]
    }
} 