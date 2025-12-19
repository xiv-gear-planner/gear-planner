import {
    el,
    FieldBoundCheckBox,
    labeledCheckbox,
    quickElement
} from "@xivgear/common-ui/components/util";
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

                    for (let i = 1; i <= maxCarts; i++) {
                        let cls: string;
                        if (i <= cartridges - 3) {
                            cls = 'gnb-cartridge-red';
                        }
                        else if (i <= cartridges) {
                            cls = 'gnb-cartridge-orange';
                        }
                        else {
                            cls = 'gnb-cartridge-default';
                        }

                        children.push(quickElement('span', [cls]));
                    }

                    children.push(quickElement('span', [], [`${cartridges}`]));
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

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        return el("div", {}, [
            labeledCheckbox("Use Potion", potCb),
            el('br'),
        ]);
    }

}
