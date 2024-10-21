import { CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse } from "@xivgear/core/sims/cycle_sim";
import { PreDmgUsedAbility } from "@xivgear/core/sims/sim_types";
import { CustomColumnSpec } from "../../../tables";
import { AbilitiesUsedTable } from "../../components/ability_used_table";
import { BaseMultiCycleSimGui } from "../../multicyclesim_ui";
import { FieldBoundFloatField, FieldBoundCheckBox, labelFor, labeledCheckbox } from "@xivgear/common-ui/components/util";
import { SamSimResult, SamSettings } from "@xivgear/core/sims/melee/sam/sam_lv100_sim";
import { SAMExtraData } from "@xivgear/core/sims/melee/sam/sam_types";

class SAMGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'kenkiGauge',
            displayName: 'Kenki',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
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
            renderer: (usedAbility?: PreDmgUsedAbility) => {
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
                        stack.style.clipPath = `polygon(0 50%, 50% 0, 100% 50%, 50% 100%)`;
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
            renderer: (usedAbility?: PreDmgUsedAbility) => {
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
                            background: '#6E95D7'
                        },
                        Getsu: {
                            mask: `radial-gradient(circle at 25% 25%, #0000 40%, #000 0)`,
                            borderRadius: '20px',
                            background: '#7462DB'
                        },
                        Ka: {
                            clipPath: `polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)`,
                            background: '#DB5858'
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
export class SamSimGui extends BaseMultiCycleSimGui<SamSimResult, SamSettings> {

    override makeCustomConfigInterface(settings: SamSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const ppField = new FieldBoundFloatField(settings, "prePullMeikyo", { inputMode: 'number' });
        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labelFor("Meikyo Pre-Pull Time:", ppField));
        configDiv.appendChild(ppField);
        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

    override makeAbilityUsedTable(result: SamSimResult): AbilitiesUsedTable {
        const extraColumns = SAMGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

}
