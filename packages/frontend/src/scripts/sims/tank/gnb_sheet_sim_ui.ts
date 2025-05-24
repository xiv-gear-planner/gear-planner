import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {GnbExtraData} from "@xivgear/core/sims/tank/gnb/gnb_types";
import {GnbSettings, GnbSimResult} from "@xivgear/core/sims/tank/gnb/gnb_sheet_sim";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";
import {extraDataDiscreteGaugeRenderer} from "../common/sim_ui_utils";

export class GnbSimGui extends BaseMultiCycleSimGui<GnbSimResult, GnbSettings> {


    protected extraAbilityUsedColumns(_: GnbSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [
            {
                shortName: 'cartridges',
                displayName: 'Cartridges',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: extraDataDiscreteGaugeRenderer<GnbExtraData>((_, extra) => {
                    const cartridges = extra.gauge.cartridges;
                    const maxCarts = extra.gauge.maxCartridges;
                    const children = [];
                    const span = document.createElement('span');
                    span.textContent = `${cartridges}`;

                    for (let i = 1; i <= maxCarts; i++) {
                        const stack = document.createElement('span');
                        // TODO: Move this to css
                        stack.style.clipPath = `circle()`;
                        stack.style.background = '#00000033';
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (i <= cartridges - 3) {
                            stack.style.background = '#f32908';
                        }
                        else if (i <= cartridges) {
                            stack.style.background = '#f37208';
                        }
                        children.push(stack);
                    }

                    children.push(span);
                    return children;
                }),
            },
            {
                shortName: 'no-mercy',
                displayName: 'No Mercy',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const noMercyDuration = (usedAbility.extraData as GnbExtraData).noMercyDuration;
                        const gauge = new GaugeWithText<number>(
                            () => '#00CED1',
                            num => `${num.toFixed(1)}s`,
                            num => num / 20 * 100
                        );
                        gauge.setDataValue(noMercyDuration);
                        gauge.classList.add('sim-gauge', 'five-digit');
                        return gauge;
                    }
                    return document.createTextNode("");
                },
            },
        ];
    }

    override makeCustomConfigInterface(settings: GnbSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));

        const pretendMicroclipsDontExistCB = new FieldBoundCheckBox(settings, "pretendThatMicroclipsDontExist");

        configDiv.appendChild(labeledCheckbox("Assume that Gnashing Fang microclips don't exist", pretendMicroclipsDontExistCB));
        return configDiv;
    }

}
