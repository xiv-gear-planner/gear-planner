import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {GnbExtraData} from "@xivgear/core/sims/tank/gnb/gnb_types";
import {GnbSettings, GnbSimResult} from "@xivgear/core/sims/tank/gnb/gnb_sheet_sim";

export class GnbSimGui extends BaseMultiCycleSimGui<GnbSimResult, GnbSettings> {


    protected extraAbilityUsedColumns(result: GnbSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [
            {
                shortName: 'cartridges',
                displayName: 'Cartridges',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const cartridges = (usedAbility.extraData as GnbExtraData).gauge.cartridges;
                        const maxCarts = (usedAbility.extraData as GnbExtraData).gauge.maxCartridges;

                        const div = document.createElement('div');
                        div.style.height = '100%';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.gap = '6px';
                        div.style.padding = '2px 0 2px 0';
                        div.style.boxSizing = 'border-box';

                        const span = document.createElement('span');
                        span.textContent = `${cartridges}`;

                        for (let i = 1; i <= maxCarts; i++) {
                            const stack = document.createElement('span');
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
                            div.appendChild(stack);
                        }

                        div.appendChild(span);

                        return div;
                    }
                    return document.createTextNode("");
                },
            },
            {
                shortName: 'no-mercy',
                displayName: 'No Mercy',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: (usedAbility?: PreDmgUsedAbility) => {
                    if (usedAbility?.extraData !== undefined) {
                        const noMercyDuration = (usedAbility.extraData as GnbExtraData).noMercyDuration;
                        const div = document.createElement('div');
                        div.style.height = '100%';
                        div.style.display = 'flex';
                        div.style.alignItems = 'center';
                        div.style.gap = '6px';
                        div.style.padding = '2px 0 2px 0';
                        div.style.boxSizing = 'border-box';

                        const span = document.createElement('span');
                        span.textContent = `${noMercyDuration.toFixed(1)}s`;

                        const barOuter = document.createElement('div');
                        barOuter.style.borderRadius = '20px';
                        barOuter.style.background = '#00000033';
                        barOuter.style.width = '120px';
                        barOuter.style.height = 'calc(100% - 3px)';
                        barOuter.style.display = 'inline-block';
                        barOuter.style.overflow = 'hidden';
                        barOuter.style.border = '1px solid black';

                        const barInner = document.createElement('div');
                        barInner.style.backgroundColor = '#00CED1';
                        barInner.style.height = '100%';
                        barInner.style.width = `${Math.round((noMercyDuration / 20) * 100)}%`;
                        barOuter.appendChild(barInner);

                        div.appendChild(barOuter);
                        div.appendChild(span);

                        return div;
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
