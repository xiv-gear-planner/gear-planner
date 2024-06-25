import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from '@xivgear/core/sims/cycle_sim';
import {UsedAbility} from "@xivgear/core/sims/sim_types";
import {NINExtraData, NINGaugeState, NinkiAbility} from './nin_types';
import {CustomColumnSpec} from '../../../tables';

class NINGauge {
    constructor(level: number) {
        this._level = level;
    }

    private _level: number;
    get level() {
        return this._level;
    }

    private _ninkiGauge: number = 0;
    get ninkiGauge() {
        return this._ninkiGauge;
    }
    set ninkiGauge(newGauge: number) {
        this._ninkiGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    spendNinki(action: NinkiAbility): void {
        action.updateGauge(this);
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

    getGaugeState(): NINGaugeState {
        return {
            level: this.level,
            ninki: this.ninkiGauge,
            kazematoi: this.kazematoi,
        }
    }

    static generateNinkiColumn(ninki: number) {
        const out = document.createElement('div');
        out.classList.add('ability-cell');

        const abilityNameSpan = document.createElement('span');
        abilityNameSpan.classList.add('ability-name');

        abilityNameSpan.textContent = `${ninki}`;

        out.appendChild(abilityNameSpan);
        return out;
    }

    static generateKazematoiColumn(kazematoi: number) {
        const out = document.createElement('div');
        out.classList.add('ability-cell');

        const abilityNameSpan = document.createElement('span');
        abilityNameSpan.classList.add('ability-name');

        abilityNameSpan.textContent = ``;

        for (let i = 1; i <= kazematoi; i++) {
            abilityNameSpan.textContent += '🗡️';
        }

        out.appendChild(abilityNameSpan);
        return out;
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            //order: 450,
            shortName: 'ninkiGauge',
            displayName: 'Ninki',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as NINExtraData).gauge as NINGaugeState;
                    return NINGauge.generateNinkiColumn(gauge.ninki);
                } else {
                    return document.createTextNode("");
                }
            }
        }, {
            //order: 460,
            shortName: 'kazematoi',
            displayName: 'Kazematoi',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as NINExtraData).gauge as NINGaugeState;
                    return NINGauge.generateKazematoiColumn(gauge.kazematoi);
                } else {
                    return document.createTextNode("");
                }
            }
        }];
    }
}

export default NINGauge;