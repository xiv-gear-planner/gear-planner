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

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'ninkiGauge',
            displayName: 'Ninki',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                let textContent = "";
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as NINExtraData).gauge;
                    textContent = `${gauge.ninki}`
                }
                return document.createTextNode(textContent);
            }
        }, {
            shortName: 'kazematoi',
            displayName: 'Kazematoi',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                let textContent = "";
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as NINExtraData).gauge;
                    textContent = '🗡️'.repeat(gauge.kazematoi);
                }
                return document.createTextNode(textContent);
            }
        }];
    }
}

export default NINGauge;