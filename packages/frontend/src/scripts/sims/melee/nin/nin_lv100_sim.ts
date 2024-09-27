import { Ability, OgcdAbility, Buff, SimSettings, SimSpec } from "@xivgear/core/sims/sim_types";
import { CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf } from "@xivgear/core/sims/cycle_sim";
import { CycleSettings } from "@xivgear/core/sims/cycle_settings";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import { BaseMultiCycleSim } from "../../sim_processors";
import { potionMaxDex } from "@xivgear/core/sims/common/potion";
import { Dokumori } from "@xivgear/core/sims/buffs";
import NINGauge from "./nin_gauge";
import { NinAbility, NinGcdAbility, MudraStep, NinjutsuAbility, NINExtraData } from "./nin_types";
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
    description: 'Simulates a NIN rotation using level 100 abilities/traits.',
    makeNewSimInstance: function (): NinSim {
        return new NinSim();
    },
    loadSavedSimInstance: function (exported: NinSettingsExternal) {
        return new NinSim(exported);
    },
    supportedJobs: ['NIN'],
    supportedLevels: [100],
    isDefaultSim: true,
    maintainers: [{
        name: 'Makar',
        contact: [{
            type: 'discord',
            discordTag: 'makar',
            discordUid: '85924030661533696'
        }],
    }],
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
        this.cycleLengthMode = 'full-duration';
        this.gauge = new NINGauge(settings.stats.level);
        this.rotationState = new RotationState();
    }

    getBuffIfActive(buff: Buff): Buff {
        return this.getActiveBuffs().find(b => b.name === buff.name);
    }

    override activateBuffWithDelay(buff: Buff, delay: number) {
        // For buffs with stacks, update the stack counter instead of adding a new buff
        if (buff.selfOnly && buff.stacks && this.getBuffIfActive(buff)) {
            return;
        }

        super.activateBuffWithDelay(buff, delay);
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: NINExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
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
                potency: modified.potency + 100,
            }
        }

        return super.use(modified);
    }

    useCombo(): AbilityUseResult {
        let fillerAction: NinGcdAbility;
        // Use Raiju if it's available
        if (this.getBuffIfActive(Buffs.RaijuReady)) {
            fillerAction = Actions.Raiju;
        } else {
            // Use the next GCD in our basic combo
            fillerAction = Actions.SpinningEdge;
            switch (this.rotationState.combo) {
                case 1: {
                    fillerAction = Actions.GustSlash;
                    break;
                }
                case 2: {
                    // Force AE during burst windows if it's available. Otherwise, keep our stacks high
                    const forceAeolian = this.getBuffIfActive(Buffs.KunaisBaneBuff) || this.getBuffIfActive(Dokumori);
                    if (this.gauge.kazematoi <= 3 && (!forceAeolian || this.gauge.kazematoi === 0)) {
                        fillerAction = Actions.ArmorCrush;
                    } else {
                        fillerAction = Actions.AeolianEdge;
                    }
                    break;
                }
            }
            this.rotationState.combo++;
        }

        return this.useGcd(fillerAction);
    }

    useMudra(step: MudraStep, useCharge?: boolean): AbilityUseResult {
        if (useCharge) {
            return this.useGcd(step);
        }

        // Use the non-charge no-cd version if we aren't consuming charges
        const modified: MudraStep = {
            ...step,
            id: step.noChargeId,
            cooldown: undefined,
        };
        return this.useGcd(modified);
    }

    useNinjutsu(action: NinjutsuAbility): AbilityUseResult {
        // Use the Mudra combination
        for (let i = 0; i < action.steps.length; i++) {
            // Only consume charges on the first step and if we don't have kassatsu
            const useCharge = i === 0 && !this.getBuffIfActive(Buffs.KassatsuBuff)
            this.useMudra(action.steps[i], useCharge);
        }

        // Use the Ninjutsu
        return this.useGcd(action);
    }

    useTCJ(): AbilityUseResult {
        const res = this.useOgcd(Actions.TenChiJin);
        // If we were unable to execute TCJ, don't continue the chain
        if (!res) {
            return null;
        }
        // Advance forward between each GCD to prevent autos
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
        return this.useGcd(Actions.Suiton);
    }

    usePhantom(): AbilityUseResult {
        if (this.getBuffIfActive(Buffs.PhantomReady)) {
            return this.useGcd(Actions.Phantom);
        }
        return null;
    }

    useNinki(): AbilityUseResult {
        if (this.gauge.ninkiReady()) {
            let action = Actions.Bhavacakra;
            // Bhava becomes ZM with Higi buff
            if (this.getBuffIfActive(Buffs.Higi)) {
                action = Actions.ZeshoMeppo;
            }
            // If we don't have ZM but Bunshin is available, prioritize Bunshin
            if (this.cdTracker.canUse(Actions.Bunshin)) {
                action = Actions.Bunshin;
            }
            return this.useOgcd(action);
        }
        return null;
    }

    useFillerOgcd(maxCount: number = 2): number {
        let oGcdCount = 0;
        // Default to pooling Ninki unless we are in a burst window
        let ninkiGaugeCap = 85;
        if (this.cdTracker.statusOf(Actions.DokumoriAbility).readyAt.relative < 5 || this.getBuffIfActive(Buffs.KunaisBaneBuff) || this.getBuffIfActive(Dokumori)) {
            ninkiGaugeCap = 50;
        }

        // Spend Ninki before overcapping
        while (this.gauge.ninkiGauge >= ninkiGaugeCap && oGcdCount < maxCount && this.useNinki()) {
            oGcdCount++;
        }

        // Use Kassatsu, but only in preparation for trick
        if (this.getBuffIfActive(Buffs.ShadowWalker) && oGcdCount < maxCount && this.useOgcd(Actions.Kassatsu)) {
            oGcdCount++;
        }

        return oGcdCount;
    }

    useOgcdInOrder(order: OgcdAbility[], idx: number): number {
        let result = null;
        if (idx < order.length) {
            // Special case for TCJ
            if ((order[idx].id === Actions.TenChiJin.id)) {
                result = this.useTCJ();
                // If TCJ was not ready, use a filler gcd and don't increase the counter
                if (result === null) {
                    this.useFillerOgcd(1);
                    this.useFillerGcd();
                    return idx;
                }
            } else {
                // Use the assigned ogcd based on a predefined order
                result = this.useOgcd(order[idx]);
            }
        }

        // If our assigned ogcd was not used, use a filler ogcd
        if (result === null) {
            this.useFillerOgcd(1);
        } else {
            // Otherwise, continue with the ogcd order chain
            idx++;
        }
        return idx;
    }

    useFillerGcd() {
        const phantomBuff = this.getActiveBuffData(Buffs.PhantomReady);
        const comboIsBetter = this.getBuffIfActive(Buffs.BunshinBuff) && (this.getBuffIfActive(Buffs.RaijuReady) || this.rotationState.combo === 2);
        const nextBuffWindow = this.cdTracker.statusOf(Actions.KunaisBane).readyAt.absolute;
        /**
         * Use Phantom if:
         *  - We would lose it if we tried to hold it for the next buff window OR
         *  - Using a combo action would be more potency (AE or Raiju w/ Bunshin) OR
         *  - We are in the middle of a burst window
         */
        if (phantomBuff && !comboIsBetter && (nextBuffWindow + 5 > phantomBuff.end || this.getBuffIfActive(Buffs.KunaisBaneBuff))) {
            this.usePhantom();
        } else {
            this.useCombo();
        }
    }

    useOpener() {
        this.useNinjutsu(Actions.Suiton);
        this.useOgcd(Actions.Kassatsu);

        this.useCombo();
        this.useOgcd(potionMaxDex);

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
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const ogcdOrder = [Actions.KunaisBane, Actions.DreamWithin];
        let counter = 0;

        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useNinjutsu(Actions.Hyosho);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useNinjutsu(Actions.Raiton);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        counter = this.useOgcdInOrder(ogcdOrder, counter);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useNinjutsu(Actions.Raiton);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        counter = this.useOgcdInOrder(ogcdOrder, counter);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        /* eslint-enable @typescript-eslint/no-unused-vars */
    }

    useEvenMinBurst() {
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const ogcdOrder = [Actions.KunaisBane, Actions.DreamWithin, Actions.TenChiJin, Actions.Meisui, Actions.TenriJindo]
        let counter = 0;

        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useNinjutsu(Actions.Hyosho);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useNinjutsu(Actions.Raiton);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        // This will optimally be TCJ combo
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        counter = this.useOgcdInOrder(ogcdOrder, counter);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        counter = this.useOgcdInOrder(ogcdOrder, counter);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useNinjutsu(Actions.Raiton);
        counter = this.useOgcdInOrder(ogcdOrder, counter);

        this.useFillerGcd();
        /* eslint-enable @typescript-eslint/no-unused-vars */
    }
}

export class NinSim extends BaseMultiCycleSim<NinSimResult, NinSettings, NINCycleProcessor> {
    spec = ninSpec;
    shortName = "nin-sim-lv100";
    displayName = ninSpec.displayName;
    manuallyActivatedBuffs = [Dokumori];
    cycleSettings: CycleSettings = {
        useAutos: true,
        totalTime: (6 * 60) + 32,
        cycles: 0,
        which: 'totalTime'
    }

    constructor(settings?: NinSettingsExternal) {
        super('NIN', settings);
    }

    makeDefaultSettings(): NinSettings {
        return {};
    }

    protected createCycleProcessor(settings: MultiCycleSettings): NINCycleProcessor {
        return new NINCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    getRotationsToSimulate(): Rotation<NINCycleProcessor>[] {
        return [{
            cycleTime: 120,
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
                    while (!cp.canUseWithoutClipping(Actions.DokumoriAbility)) {
                        cp.useFillerOgcd();
                        cp.useFillerGcd();
                        if (cp.remainingGcdTime <= 0) {
                            return;
                        }
                    }
                    cp.useOgcd(Actions.DokumoriAbility);

                    while (!cp.canUseWithoutClipping(Actions.KunaisBane)) {
                        cp.useFillerOgcd();
                        if (cp.canUseWithoutClipping(Actions.KunaisBane)) {
                            if (cp.remainingGcdTime <= 0) {
                                return;
                            }
                            break;
                        }
                        cp.useFillerGcd();
                        if (cp.remainingGcdTime <= 0) {
                            return;
                        }
                    }

                    cp.useEvenMinBurst();
                });
            }
        }]
    }
} 