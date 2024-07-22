import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { CustomColumnSpec } from "../../../tables";
import { UsedAbility } from "@xivgear/core/sims/sim_types";
import { VprExtraData, VprGaugeState } from "./vpr_types";

export class VprGauge {

    private _serpentOfferings: number = 0;
    get serpentOfferings(): number {
        return this._serpentOfferings;
    }
    set serpentOfferings(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Serpent Offerings by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`Used ${this._serpentOfferings - newGauge} when you only have ${this._serpentOfferings}.`)
        }
        this._serpentOfferings = Math.max(Math.min(newGauge, 100), 0);
    }

    private _rattlingCoils: number = 0;
    get rattlingCoils(): number {
        return this._rattlingCoils;
    }
    set rattlingCoils(newCoils: number) {
        if (newCoils > 3) {
            console.warn(`Overcapped Rattling Coils by ${newCoils - 3}.`);
        }
        if (newCoils < 0) {
            console.warn(`Used Rattling coils when empty`)
        }

        this._rattlingCoils = Math.max(Math.min(newCoils, 3), 0);
    }


    getGaugeState(): VprGaugeState {
        return {
            level: 100,
            serpentOfferings: this.serpentOfferings,
            rattlingCoils: this.rattlingCoils,
        }
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'serpentOfferings',
            displayName: 'Serpent Offerings',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const serpentOfferings = (usedAbility.extraData as VprExtraData).gauge.serpentOfferings;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${serpentOfferings}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = serpentOfferings < 50 ? '#d22017' : '#61d0ec';
                    barInner.style.width = `${serpentOfferings}%`;
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
            shortName: 'rattlingCoils',
            displayName: 'Rattling Coils',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const rattlingCoils = (usedAbility.extraData as VprExtraData).gauge.rattlingCoils;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    div.style.gap = '4px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    for (let i = 1; i <= 3; i++) {
                        const stack = document.createElement('span');
                        stack.style.clipPath = `polygon(0 50%, 50% 0, 100% 50%, 50% 100%, 0% 50%)`;
                        stack.style.background = '#00000033';
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (i <= rattlingCoils) {
                            stack.style.background = '#84100F';
                        }
                        div.appendChild(stack);
                    }

                    return div;
                }
                return document.createTextNode("");
            }
        },
        ];
    }
}