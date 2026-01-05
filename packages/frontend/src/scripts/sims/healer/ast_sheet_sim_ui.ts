import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {col, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AstExtraData, AstSettings, AstSimResult} from "@xivgear/core/sims/healer/ast_sheet_sim";
import {StyleSwitcher, WritableCssProp} from "@xivgear/common-ui/util/types";
import {extraDataDiscreteGaugeRenderer} from "../common/sim_ui_utils";

export class AstSheetSimGui extends BaseMultiCycleSimGui<AstSimResult, AstSettings> {


    protected extraAbilityUsedColumns(result: AstSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
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
        return [col({
            shortName: 'cards',
            displayName: 'Cards',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: extraDataDiscreteGaugeRenderer<AstExtraData>((_, extra) => {

                const children = [];

                const cards = extra.gauge.cards;
                for (const key in cardStyles) {
                    const stack = document.createElement('span');
                    for (const [k, v] of Object.entries(cardStyles[key as keyof typeof cardStyles])) {
                        stack.style[k as WritableCssProp] = v;
                    }
                    if (!cards.has(key)) {
                        stack.style.background = '#00000033';
                    }
                    children.push(stack);
                }
                return children;
            }),
        })];
    }
}
