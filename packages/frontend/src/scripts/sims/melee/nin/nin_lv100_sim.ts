import {GcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
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

    spendNinki(): void {
        this.ninkiGauge -= 50;
    }

    ninkiReady(): boolean {
        return this.ninkiGauge >= 50;
    }

    private _kazematoi: number = 0;
    get kazematoi() {
        return this._kazematoi;
    }
    set kazematoi(newGauge: number) {
        this._kazematoi = Math.max(Math.min(newGauge, 5), 0);
    }

    spendKazematoi(): void {
        this.kazematoi -= 1;
    }

    grantKazematoi(): void {
        this.kazematoi += 2;
    }

    private _raijuStacks: number = 0;
    get raijuStacks() {
        return this._raijuStacks;
    }
    set raijuStacks(newStacks: number) {
        this._raijuStacks = Math.max(Math.min(newStacks, 3), 0);
    }

    raijuReady(): boolean {
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

    useMudra(cp: CycleProcessor, step: Actions.MudraStep, useCharge?: boolean) {
        if (useCharge) {
            const modified: GcdAbility = {
                ...Actions.MudraStart,
                name: step.name,
            }
            cp.useGcd(modified);
        } else {
            const modified: GcdAbility = {
                ...Actions.MudraFollowup,
                ...step,
            }
            cp.useGcd(modified);
        }
    }

    useNinjutsu(cp: CycleProcessor, action: Actions.NinjutsuAbility) {
        // Use the Mudra combination
        for (let i = 0; i < action.steps.length; i++) {
            // Only consume charges on the first step and if we don't have kassatsu
            const useCharge = i === 0 && !cp.getActiveBuffs().find(b => b.name === Buffs.KassatsuBuff.name)
            this.useMudra(cp, action.steps[i], useCharge);
        }

        // Use the Ninjutsu
        cp.useGcd(action);

        // Apply Raiju stacks
        if (action.addRaiju) {
            this.rotationState.raijuStacks++;
        }
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
            this.rotationState.ninkiGauge += 5;
        }
    }

    usePhantom(cp: CycleProcessor) {
        if (cp.getActiveBuffs().find(b => b.name === Buffs.PhantomReady.name)) {
            cp.useGcd(Actions.Phantom);
            this.rotationState.ninkiGauge += 10;
        }
    }

    useNinki(cp: CycleProcessor) {
        if (this.rotationState.ninkiReady()) {
            if (cp.getActiveBuffs().find(b => b.name === Buffs.Higi.name)) {
                cp.useOgcd(Actions.Bhavacakra);
            } else {
                cp.useOgcd(Actions.ZeshoMeppo);
            }
            this.rotationState.spendNinki();
        }
    }

    useOpener(cp: CycleProcessor) {
        this.useNinjutsu(cp, Actions.Suiton);
        cp.useOgcd(Actions.Kassatsu);

        cp.useGcd(Actions.SpinningEdge);
        // TODO: Use pot here

        cp.useGcd(Actions.GustSlash);
        cp.useOgcd(Actions.DokumoriAbility);
        cp.useOgcd(Actions.Bunshin);

        cp.useGcd(Actions.Phantom);

        cp.useGcd(Actions.ArmorCrush);
        cp.useOgcd(Actions.KunaisBane);

        this.useNinjutsu(cp, Actions.Hyosho);
        cp.useOgcd(Actions.DreamWithin);

        this.useNinjutsu(cp, Actions.Raiton);

        this.useTCJ(cp);
        cp.useOgcd(Actions.Meisui);

        this.useRaiju(cp);
        this.useNinki(cp);
        cp.useOgcd(Actions.TenriJindo);

        this.useRaiju(cp);
        this.useNinki(cp);

        this.useNinjutsu(cp, Actions.Raiton);

        this.useRaiju(cp);
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
                sim.useOpener(cp);
            }
        }]
    }
} 