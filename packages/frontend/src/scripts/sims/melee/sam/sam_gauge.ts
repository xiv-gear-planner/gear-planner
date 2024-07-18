import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from '@xivgear/core/sims/cycle_sim';
import { UsedAbility } from "@xivgear/core/sims/sim_types";
import { SAMExtraData, SAMGaugeState, KenkiAbility } from './sam_types';
import { CustomColumnSpec } from '../../../tables';

class SAMGauge {
    constructor(level: number) {
        this._level = level;
    }

    private _level: number;
    get level() {
        return this._level;
    }

    private _kenkiGauge: number = 0;
    get kenkiGauge() {
        return this._kenkiGauge;
    }
    set kenkiGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Kenki by ${newGauge - 100}.`);
        } else if (newGauge < 0) {
            console.error(`Used ${this.kenkiGauge - newGauge} Kenki when you only have ${this.kenkiGauge}.`)
        }
        this._kenkiGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    spendKenki(action: KenkiAbility): void {
        action.updateGauge(this);
    }

    private _meditation: number = 0;
    get meditation() {
        return this._meditation;
    }
    set meditation(newGauge: number) {
        this._meditation = Math.max(Math.min(newGauge, 3), 0);
    }

    spendMeditation(): void {
        this.meditation = 0;
    }

    private _sen: Set<string> = new Set<string>();
    get sen() {
        return this._sen;
    }
    set sen(newSen: Set<string>) {
        this._sen = newSen;
    }

    addSen(newSen: string): void {
        this._sen.add(newSen);
    }
    spendSen(): void {
        this._sen.clear();
    }

    getGaugeState(): SAMGaugeState {
        return {
            level: this.level,
            sen: new Set([...this.sen]),
            kenki: this.kenkiGauge,
            meditation: this.meditation,
        }
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'kenkiGauge',
            displayName: 'Kenki',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const kenki = (usedAbility.extraData as SAMExtraData).gauge.kenki;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${kenki}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = '#DB5858';
                    barInner.style.width = `${kenki}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            }
        }, {
            shortName: 'meditation',
            displayName: 'Meditation',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const meditation = (usedAbility.extraData as SAMExtraData).gauge.meditation;

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
                        stack.style.clipPath = `polygon(
                            0 50%,
                            50% 0,
                            50% 0,
                            100% 50%,
                            100% 50%,
                            50% 100%,
                            50% 100%,
                            0% 50% 
                        )`
                        stack.style.background = '#00000033';
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (i <= meditation) {
                            stack.style.background = '#FF6723';
                        }
                        div.appendChild(stack);
                    }

                    return div;
                }
                return document.createTextNode("");
            }
        }, {
            shortName: 'sen',
            displayName: 'Sen',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const sen = (usedAbility.extraData as SAMExtraData).gauge.sen;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    div.style.gap = '4px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const senStyles = {
                        Setsu: {
                            clipPath: `polygon(50% 0%, 64% 25%, 92% 25%, 78% 50%, 92% 75%, 64% 75%, 50% 100%, 36% 75%, 8% 75%, 22% 50%, 8% 25%, 36% 25%)`,
                            background: '#6E95D7',
                        },
                        Getsu: {
                            mask: `radial-gradient(circle at 25% 25%, #0000 40%, #000 0)`,
                            borderRadius: '20px',
                            background: '#7462DB',
                        },
                        Ka: {
                            clipPath: `polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)`,
                            background: '#DB5858',
                        }
                    };

                    Object.keys(senStyles).forEach(key => {
                        const stack = document.createElement('span');
                        for (const [k, v] of Object.entries(senStyles[key])) {
                            stack.style[k] = v;
                        }
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (!sen.has(key)) {
                            stack.style.background = '#00000033';
                        }
                        div.appendChild(stack);
                    });

                    return div;
                }
                return document.createTextNode("");
            }
        }];
    }
}

export default SAMGauge;