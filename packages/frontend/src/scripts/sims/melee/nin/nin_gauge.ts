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
                if (usedAbility?.extraData !== undefined) {
                    const gauge = (usedAbility.extraData as NINExtraData).gauge;
                    const rowHeight = Number(getComputedStyle(document.body).getPropertyValue('--abilities-row-height').replace('px', ''));
                    const cellWidth = 120;
                    const padding = 6;
                    const svgHeight = rowHeight - padding;

                    const div = document.createElement('div');
                    const span = document.createElement('span');
                    span.textContent = `${gauge.ninki}`;

                    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    svg.setAttribute('width', `${cellWidth}`);
                    svg.setAttribute('height', `${svgHeight}`);
                    svg.setAttribute('style', `border-radius: 50px; border: 1px solid black; margin-right: ${padding}px;`);

                    const bar = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    bar.setAttribute('fill', 'black');
                    bar.setAttribute('style', 'opacity: 0.2;');

                    const ninki = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    ninki.setAttribute('fill', '#995691');

                    bar.setAttribute('d', `M 0,0
                        l ${cellWidth}, 0
                        l 0, ${svgHeight}
                        l -${cellWidth}, 0
                    z`);


                    ninki.setAttribute('d', `M 0,0
                        l ${Math.round(gauge.ninki / 100 * cellWidth)}, 0
                        l 0, ${rowHeight}
                        l -${Math.round(gauge.ninki / 100 * cellWidth)}, 0
                    z`);

                    svg.appendChild(bar);
                    svg.appendChild(ninki);
                    div.appendChild(svg);
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