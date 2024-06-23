import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {CycleSettings} from "@xivgear/core/sims/cycle_settings";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
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

class NINCycleProcessor extends CycleProcessor {
    rotationState: RotationState = new RotationState();

    canUseWithoutClipping(action: OgcdAbility) {
        const readyAt = this.cdTracker.statusOf(action).readyAt.absolute;
        const maxDelayAt = this.nextGcdTime - (action.animationLock ?? STANDARD_ANIMATION_LOCK);
        return readyAt <= maxDelayAt;
    }

    updateGauge(action: Ability) {
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

        if (this.getActiveBuffs().find(b => b.name === Buffs.BunshinBuff.name) && action.attackType === 'Weaponskill') {
            this.rotationState.ninkiGauge += 5;
        }
    }

    useCombo(forceAeolian?: boolean) {
        let fillerAction: GcdAbility;
        if (this.rotationState.raijuReady()) {
            fillerAction = Actions.Raiju;
        } else {
            fillerAction = Actions.SpinningEdge;
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
        }

        this.updateGauge(fillerAction);
        this.useGcd(fillerAction);
    }

    useMudra(step: Actions.MudraStep, useCharge?: boolean) {
        if (useCharge) {
            this.useGcd(step);
        } else {
            const modified: GcdAbility = {
                ...step,
                id: step.noChargeId,
                cooldown: undefined,
            };
            this.useGcd(modified);
        }
    }

    useNinjutsu(action: Actions.NinjutsuAbility) {
        // Use the Mudra combination
        for (let i = 0; i < action.steps.length; i++) {
            // Only consume charges on the first step and if we don't have kassatsu
            const useCharge = i === 0 && !this.getActiveBuffs().find(b => b.name === Buffs.KassatsuBuff.name)
            this.useMudra(action.steps[i], useCharge);
        }

        // Use the Ninjutsu
        this.useGcd(action);

        // Apply Raiju stacks
        if (action.addRaiju) {
            this.rotationState.raijuStacks++;
        }
    }

    useTCJ() {
        this.useOgcd(Actions.TenChiJin);
        this.useGcd(Actions.Fuma);
        this.useGcd(Actions.Raiton);
        this.rotationState.raijuStacks++;
        this.useGcd(Actions.Suiton);
    }

    usePhantom() {
        if (this.getActiveBuffs().find(b => b.name === Buffs.PhantomReady.name)) {
            this.updateGauge(Actions.Phantom);
            this.useGcd(Actions.Phantom);
        }
    }

    useMeisui() {
        this.updateGauge(Actions.Meisui);
        this.useOgcd(Actions.Meisui);
    }

    useNinki() {
        if (this.rotationState.ninkiReady()) {
            let action = Actions.Bhavacakra;
            if (this.getActiveBuffs().find(b => b.name === Buffs.Higi.name)) {
                action = Actions.ZeshoMeppo;
            } else if (this.cdTracker.canUse(Actions.Bunshin)) {
                action = Actions.Bunshin;
            }
            this.useOgcd(action);
            this.rotationState.spendNinki(action);
        }
    }

    useOgcdIfReady(action: OgcdAbility, counter: number, maxCount: number): number {
        if (counter < maxCount && this.cdTracker.canUse(action)) {
            if (Actions.isNinkiAbility(action)) {
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
        if (this.rotationState.ninkiGauge >= ninkiGaugeCap) {
            oGcdCount = this.useOgcdIfReady(Actions.Bunshin, oGcdCount, maxOgcdCount);
            oGcdCount = this.useOgcdIfReady(Actions.Bhavacakra, oGcdCount, maxOgcdCount);
        }

        // Use Kassatsu, but only in preparation for trick
        if (this.getActiveBuffs().find(b => b.name === Buffs.ShadowWalker.name)) {
            oGcdCount = this.useOgcdIfReady(Actions.Kassatsu, oGcdCount, maxOgcdCount);
        }

        return oGcdCount;
    }

    useFillerGcd() {
        if (this.getActiveBuffs().find(b => b.name === Buffs.PhantomReady.name)) {
            this.usePhantom();
        } else {
            this.useCombo();
        }
    }

    useOpener() {
        this.useNinjutsu(Actions.Suiton);
        this.useOgcd(Actions.Kassatsu);

        this.useCombo();
        // TODO: Use pot here

        this.useCombo();
        this.useOgcd(Actions.DokumoriAbility);
        this.useOgcd(Actions.Bunshin);
        this.rotationState.spendNinki(Actions.Bunshin);

        this.usePhantom();

        this.useCombo();
        this.useOgcd(Actions.KunaisBane);

        this.useNinjutsu(Actions.Hyosho);
        this.useOgcd(Actions.DreamWithin);

        this.useNinjutsu(Actions.Raiton);

        this.useTCJ();
        this.useMeisui();

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
        this.useMeisui();
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

    protected createCycleProcessor(settings: MultiCycleSettings): NINCycleProcessor {
        return new NINCycleProcessor(settings);
    }

    getRotationsToSimulate(): Rotation<NINCycleProcessor>[] {
        return [{
            cycleTime: 6 * 60,
            apply(cp: NINCycleProcessor) {
                cp.useOpener();

                while (cp.remainingGcdTime > 0) {
                    while ((cp.cdTracker.statusOf(Actions.KunaisBane).readyAt.relative > 20 || !cp.cdTracker.canUse(Actions.Ten)) && cp.remainingGcdTime > 0) {
                        cp.useFillerGcd();
                        cp.useFillerOgcd();
                    }

                    cp.useNinjutsu(Actions.Suiton);

                    cp.useFillerGcd();
                    while (!cp.canUseWithoutClipping(Actions.KunaisBane) && cp.remainingGcdTime > 0) {
                        cp.useFillerOgcd();
                        cp.useFillerGcd();
                    }

                    cp.advanceTo(cp.nextGcdTime - (Actions.KunaisBane.animationLock ?? STANDARD_ANIMATION_LOCK));
                    cp.useOddMinBurst();

                    while ((cp.cdTracker.statusOf(Actions.KunaisBane).readyAt.relative > 20 || !cp.cdTracker.canUse(Actions.Ten)) && cp.remainingGcdTime > 0) {
                        cp.useFillerGcd();
                        cp.useFillerOgcd();
                    }

                    cp.useNinjutsu(Actions.Suiton);

                    cp.useFillerGcd();
                    while (!(cp.canUseWithoutClipping(Actions.DokumoriAbility) && cp.canUseWithoutClipping(Actions.KunaisBane)) && cp.remainingGcdTime > 0) {
                        cp.useFillerOgcd();
                        cp.useFillerGcd();
                    }

                    cp.advanceTo(cp.nextGcdTime - (Actions.DokumoriAbility.animationLock ?? STANDARD_ANIMATION_LOCK));
                    cp.useEvenMinBurst();
                }
            }
        }]
    }
} 