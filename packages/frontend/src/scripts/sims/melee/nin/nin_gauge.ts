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
        if (newGauge > 100) {
            console.warn(`Overcapped Ninki by ${newGauge - 100}.`);
        } else if (newGauge < 0) {
            console.error(`Used ${this.ninkiGauge - newGauge} Ninki when you only have ${this.ninkiGauge}.`)
        }
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
                if (usedAbility?.extraData !== undefined) {
                    const ninki = (usedAbility.extraData as NINExtraData).gauge.ninki;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${ninki}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = ninki > 50 ? '#DB5858' : '#995691';
                    barInner.style.width = `${ninki}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
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