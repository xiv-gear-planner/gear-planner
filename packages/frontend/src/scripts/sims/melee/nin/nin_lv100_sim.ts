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

    spendNinki(action: Actions.NinkiAbility): void {
        this.ninkiGauge -= action.ninkiCost;
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

    updateGauge(cp: CycleProcessor, action: Ability) {
        switch (action) {
            case Actions.SpinningEdge: {
                this.rotationState.ninkiGauge += 5;
                break;
            }
            case Actions.GustSlash: {
                this.rotationState.ninkiGauge += 5;
                break;
            }
            case Actions.ArmorCrush: {
                this.rotationState.kazematoi += 2;
                this.rotationState.ninkiGauge += 15;
                break;
            }
            case Actions.AeolianEdge: {
                this.rotationState.kazematoi--;
                this.rotationState.ninkiGauge += 15;
                break;
            }
            case Actions.Phantom: {
                this.rotationState.ninkiGauge += 10;
                break;
            }
            case Actions.Raiju: {
                this.rotationState.raijuStacks--;
                this.rotationState.ninkiGauge += 5;
                break;
            }
            case Actions.Meisui: {
                this.rotationState.ninkiGauge += 50;
                break;
            }
        }

        if (cp.getActiveBuffs().find(b => b.name === Buffs.BunshinBuff.name) && action.attackType === 'Weaponskill') {
            this.rotationState.ninkiGauge += 5;
        }
    }

    useCombo(cp: CycleProcessor, forceAeolian?: boolean) {
        let fillerAction: GcdAbility = Actions.SpinningEdge;
        switch (this.rotationState.combo) {
            case 1: {
                fillerAction = Actions.GustSlash;
                break;
            }
            case 2: {
                if (this.rotationState.kazematoi <= 3 && !forceAeolian) {
                    fillerAction = Actions.ArmorCrush;
                } else {
                    fillerAction = Actions.AeolianEdge;
                }
                break;
            }
        }
        this.rotationState.combo++;
        this.updateGauge(cp, fillerAction);
        cp.useGcd(fillerAction);
    }

    useMudra(cp: CycleProcessor, step: Actions.MudraStep, useCharge?: boolean) {
        if (useCharge) {
            cp.useGcd(Actions.MudraStart);
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
            this.updateGauge(cp, Actions.Raiju);
            cp.useGcd(Actions.Raiju);
        }
    }

    usePhantom(cp: CycleProcessor) {
        if (cp.getActiveBuffs().find(b => b.name === Buffs.PhantomReady.name)) {
            this.updateGauge(cp, Actions.Phantom);
            cp.useGcd(Actions.Phantom);
        }
    }

    useMeisui(cp: CycleProcessor) {
        this.updateGauge(cp, Actions.Meisui);
        cp.useOgcd(Actions.Meisui);
    }

    useNinki(cp: CycleProcessor) {
        if (this.rotationState.ninkiReady()) {
            let action = Actions.Bhavacakra;
            if (cp.getActiveBuffs().find(b => b.name === Buffs.Higi.name)) {
                action = Actions.ZeshoMeppo;
            } else if (cp.cdTracker.canUse(Actions.Bunshin)) {
                action = Actions.Bunshin;
            }
            cp.useOgcd(action);
            this.rotationState.spendNinki(action);
        }
    }

    useOpener(cp: CycleProcessor) {
        this.useNinjutsu(cp, Actions.Suiton);
        cp.useOgcd(Actions.Kassatsu);

        this.useCombo(cp);
        // TODO: Use pot here

        this.useCombo(cp);
        cp.useOgcd(Actions.DokumoriAbility);
        cp.useOgcd(Actions.Bunshin);
        this.rotationState.spendNinki(Actions.Bunshin);

        this.usePhantom(cp);

        this.useCombo(cp);
        cp.useOgcd(Actions.KunaisBane);

        this.useNinjutsu(cp, Actions.Hyosho);
        cp.useOgcd(Actions.DreamWithin);

        this.useNinjutsu(cp, Actions.Raiton);

        this.useTCJ(cp);
        this.useMeisui(cp);

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

    useOgcdIfReady(cp: CycleProcessor, action: OgcdAbility, counter: number): number {
        if (counter < 2 && cp.cdTracker.canUse(action)) {
            if (Actions.isNinkiAbility(action)) {
                this.useNinki(cp);
            } else {
                cp.useOgcd(action);
            }
            counter++;
        }
        return counter;
    }

    useFillerOgcd(cp: CycleProcessor): number {
        // TODO: Use some kind of helper method to determine if an ogcd can be used without clipping instead
        let oGcdCount = 0;

        // Spend Ninki before overcapping
        if (this.rotationState.ninkiGauge >= 85) {
            oGcdCount = this.useOgcdIfReady(cp, Actions.Bunshin, oGcdCount);
            oGcdCount = this.useOgcdIfReady(cp, Actions.Bhavacakra, oGcdCount);
        }

        // Use Kassatsu, but only in preparation for trick
        if (cp.getActiveBuffs().find(b => b.name === Buffs.ShadowWalker.name) && cp.cdTracker.canUse(Actions.Kassatsu)) {
            oGcdCount = this.useOgcdIfReady(cp, Actions.Kassatsu, oGcdCount);
        }

        return oGcdCount;
    }

    useFillerGcd(cp: CycleProcessor) {
        if (cp.getActiveBuffs().find(b => b.name === Buffs.PhantomReady.name)) {
            this.usePhantom(cp);
        } else {
            this.useCombo(cp);
        }
    }

    getRotationsToSimulate(): Rotation[] {
        const sim = this;
        this.rotationState = new RotationState();
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                sim.useOpener(cp);

                while (cp.cdTracker.statusOf(Actions.KunaisBane).readyAt.relative > 20 || !cp.cdTracker.canUse(Actions.MudraStart)) {
                    sim.useFillerGcd(cp);
                    sim.useFillerOgcd(cp);
                }

                sim.useNinjutsu(cp, Actions.Suiton);

                while (!cp.cdTracker.canUse(Actions.KunaisBane)) {
                    sim.useFillerGcd(cp);
                    sim.useFillerOgcd(cp);
                }

                sim.useOddMinBurst(cp);
            }
        }]
    }
} 