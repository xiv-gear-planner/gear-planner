import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { CustomColumnSpec } from "../../../tables";
import { AbilitiesUsedTable } from "../../components/ability_used_table";
import { BaseMultiCycleSimGui } from "../../multicyclesim_ui";
import { MnkSimResult, MnkSettings } from "@xivgear/core/sims/melee/mnk/mnk_sim";
import { PreDmgUsedAbility } from "@xivgear/core/sims/sim_types";
import { MNKExtraData } from "@xivgear/core/sims/melee/mnk/mnk_types";

class MNKGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [
            //             {
            //                 shortName: 'chakra',
            //                 displayName: 'Chakra',
            //                 getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            //                 renderer: (usedAbility?: PreDmgUsedAbility) => {
            //                     if (usedAbility?.extraData !== undefined) {
            //                         const chakra = (usedAbility.extraData as MNKExtraData).gauge.chakra;
            //                         const div = document.createElement('div');
            //                         div.style.height = '100%';
            //                         div.style.display = 'flex';
            //                         div.style.alignItems = 'center';
            //                         div.style.gap = '6px';
            //                         div.style.padding = '2px 0 2px 0';
            //                         div.style.boxSizing = 'border-box';
            //
            //                         const span = document.createElement('span');
            //                         span.textContent = `${chakra}`;
            //
            //                         const barOuter = document.createElement('div');
            //                         barOuter.style.borderRadius = '20px';
            //                         barOuter.style.background = '#00000033';
            //                         barOuter.style.width = '120px';
            //                         barOuter.style.height = 'calc(100% - 3px)';
            //                         barOuter.style.display = 'inline-block';
            //                         barOuter.style.overflow = 'hidden';
            //                         barOuter.style.border = '1px solid black';
            //
            //                         const barInner = document.createElement('div');
            //                         barInner.style.backgroundColor = '#DB5858';
            //                         barInner.style.width = `${chakra}%`;
            //                         barInner.style.height = '100%';
            //                         barOuter.appendChild(barInner);
            //
            //                         div.appendChild(barOuter);
            //                         div.appendChild(span);
            //
            //                         return div;
            //                     }
            //                     return document.createTextNode("");
            //                 },
            //             },
            {
                shortName: 'fury',
                displayName: "Beast Fury Gauge",
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const opoFury = (usedAbility.extraData as MNKExtraData).gauge.opoFury;
                        const raptorFury = (usedAbility.extraData as MNKExtraData).gauge.raptorFury;
                        const coeurlFury = (usedAbility.extraData as MNKExtraData).gauge.coeurlFury;

                        const div = document.createElement('div');
                        div.style.height = '100%';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.justifyContent = 'center';
                        div.style.gap = '4px';
                        div.style.padding = '2px 0 2px 0';
                        div.style.boxSizing = 'border-box';

                        for (let i = 0; i < 1; i++) {
                            const stack = document.createElement('span');
                            stack.style.clipPath = `circle()`;
                            stack.style.background = '#00000033';
                            stack.style.height = '100%';
                            stack.style.width = '16px';
                            stack.style.display = 'inline-block';
                            stack.style.overflow = 'hidden';
                            if (i < opoFury) {
                                stack.style.background = '#f796c6';
                            }
                            div.appendChild(stack);
                        }

                        for (let i = 0; i < 1; i++) {
                            const stack = document.createElement('span');
                            stack.style.clipPath = `circle()`;
                            stack.style.background = '#00000033';
                            stack.style.height = '100%';
                            stack.style.width = '16px';
                            stack.style.display = 'inline-block';
                            stack.style.overflow = 'hidden';
                            if (i < raptorFury) {
                                stack.style.background = '#cd9bff';
                            }
                            div.appendChild(stack);
                        }

                        for (let i = 0; i < 2; i++) {
                            const stack = document.createElement('span');
                            stack.style.clipPath = `circle()`;
                            stack.style.background = '#00000033';
                            stack.style.height = '100%';
                            stack.style.width = '16px';
                            stack.style.display = 'inline-block';
                            stack.style.overflow = 'hidden';
                            if (i < coeurlFury) {
                                stack.style.background = '#83ffaa';
                            }
                            div.appendChild(stack);
                        }

                        return div;
                    }
                    return document.createTextNode("");
                }
            },
            {
                shortName: 'nadi',
                displayName: "Nadi Gauge",
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const lNadi = (usedAbility.extraData as MNKExtraData).gauge.lunarNadi;
                        const sNadi = (usedAbility.extraData as MNKExtraData).gauge.solarNadi;

                        const div = document.createElement('div');
                        div.style.height = '100%';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.justifyContent = 'center';
                        div.style.gap = '4px';
                        div.style.padding = '2px 0 2px 0';
                        div.style.boxSizing = 'border-box';

                        for (let i = 0; i < 1; i++) {
                            const stack = document.createElement('span');
                            stack.style.clipPath = `circle()`;
                            stack.style.background = '#00000033';
                            stack.style.height = '100%';
                            stack.style.width = '16px';
                            stack.style.display = 'inline-block';
                            stack.style.overflow = 'hidden';
                            if (i < lNadi) {
                                stack.style.background = '#bd86ff';
                            }
                            div.appendChild(stack);
                        }

                        for (let i = 0; i < 1; i++) {
                            const stack = document.createElement('span');
                            stack.style.clipPath = `circle()`;
                            stack.style.background = '#00000033';
                            stack.style.height = '100%';
                            stack.style.width = '16px';
                            stack.style.display = 'inline-block';
                            stack.style.overflow = 'hidden';
                            if (i < sNadi) {
                                stack.style.background = '#FFFFFF';
                            }
                            div.appendChild(stack);
                        }

                        return div;
                    }
                    return document.createTextNode("");
                }
            },
            {
                shortName: 'beastChakra',
                displayName: "Beast Chakra Gauge",
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const chakra = (usedAbility.extraData as MNKExtraData).gauge.beastChakra;

                        const div = document.createElement('div');
                        div.style.height = '100%';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.justifyContent = 'center';
                        div.style.gap = '4px';
                        div.style.padding = '2px 0 2px 0';
                        div.style.boxSizing = 'border-box';

                        for (let i = 0; i < 3; i++) {
                            const stack = document.createElement('span');
                            stack.style.clipPath = `polygon(0 50%, 50% 0, 100% 50%, 50% 100%)`;
                            stack.style.background = '#00000033';
                            stack.style.height = '100%';
                            stack.style.width = '16px';
                            stack.style.display = 'inline-block';
                            stack.style.overflow = 'hidden';
                            switch (chakra[i]) {
                                case "opo":
                                    stack.style.background = '#f786bd';
                                    break;
                                case "raptor":
                                    stack.style.background = '#ad79d6';
                                    break;
                                case "coeurl":
                                    stack.style.background = '#65b291';
                                    break;
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
export class MnkSimGui extends BaseMultiCycleSimGui<MnkSimResult, MnkSettings> {

    override makeCustomConfigInterface(settings: MnkSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        return configDiv;
    }

    override makeAbilityUsedTable(result: MnkSimResult): AbilitiesUsedTable {
        const extraColumns = MNKGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
