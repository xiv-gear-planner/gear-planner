import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { CustomColumnSpec } from "../../../tables";
import { UsedAbility } from "@xivgear/core/sims/sim_types";
import { RprExtraData, RprGaugeState } from "./rpr_types";

export class RprGauge {

    private _soulGauge: number = 0;
    get soulGauge(): number {
        return this._soulGauge;
    }
    set soulGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Soul by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`Use ${this._soulGauge - newGauge} when you only have ${this._soulGauge}.`)
        }
        this._soulGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    _shroudGauge: number = 0;
    get shroudGauge(): number {
        return this._shroudGauge;
    }
    set shroudGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped shroud by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`Use ${this._shroudGauge - newGauge} when you only have ${this._shroudGauge}.`)
        }
        this._shroudGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    getGaugeState(): RprGaugeState {
        return {
            level: 100,
            soul: this.soulGauge,
            shroud: this.shroudGauge,
        }
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'soulGauge',
            displayName: 'Soul',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const soul = (usedAbility.extraData as RprExtraData).gauge.soul;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${soul}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = soul >= 50 ? '#e5004e' : '#660929';
                    barInner.style.width = `${soul}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            }
        },
        {
            shortName: 'shroudGauge',
            displayName: 'Shroud',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const shroud = (usedAbility.extraData as RprExtraData).gauge.shroud;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${shroud}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = shroud >= 50 ? '#00fcf3' : '#03706c';
                    barInner.style.width = `${shroud}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            }
        },
        ];
    }
}