import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {col, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AstExtraData, AstSettings, AstSimResult} from "@xivgear/core/sims/healer/ast_sheet_sim";
import {StyleSwitcher, WritableCssProp} from "@xivgear/common-ui/util/types";

export class AstSheetSimGui extends BaseMultiCycleSimGui<AstSimResult, AstSettings> {


    protected extraAbilityUsedColumns(result: AstSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'cards',
            displayName: 'Cards',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const cards = (usedAbility.extraData as AstExtraData).gauge.cards;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    div.style.gap = '4px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const cardStyles: StyleSwitcher = {
                        Balance: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#ff6f00',
                        },
                        Arrow: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#69ebff',
                        },
                        Spire: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#fff700',
                        },
                        Lord: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#bd040a',
                        },
                        Spear: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#0059ff',
                        },
                        Bole: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#00bd23',
                        },
                        Ewer: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#00ddff',
                        },
                        Lady: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#ffe4d6',
                        },
                    } as const;

                    for (const key in cardStyles) {
                        const stack = document.createElement('span');
                        for (const [k, v] of Object.entries(cardStyles[key as keyof typeof cardStyles])) {
                            stack.style[k as WritableCssProp] = v;
                        }
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (!cards.has(key)) {
                            stack.style.background = '#00000033';
                        }
                        div.appendChild(stack);
                    }
                    ;

                    return div;
                }
                return document.createTextNode("");
            },
        }),
        ];
    }
}
