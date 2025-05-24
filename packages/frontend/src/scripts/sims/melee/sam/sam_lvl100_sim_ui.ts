import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {
    FieldBoundCheckBox,
    FieldBoundFloatField,
    labeledCheckbox,
    labelFor,
    quickElement
} from "@xivgear/common-ui/components/util";
import {SamSettings, SamSimResult} from "@xivgear/core/sims/melee/sam/sam_lv100_sim";
import {SAMExtraData} from "@xivgear/core/sims/melee/sam/sam_types";
import {StyleSwitcher, WritableCssProp} from "@xivgear/common-ui/util/types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";
import {extraDataDiscreteGaugeRenderer} from "../../common/sim_ui_utils";

export class SamSimGui extends BaseMultiCycleSimGui<SamSimResult, SamSettings> {

    protected extraAbilityUsedColumns(result: SamSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'kenkiGauge',
            displayName: 'Kenki',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const kenki = (usedAbility.extraData as SAMExtraData).gauge.kenki;

                    const gauge = new GaugeWithText<number>(
                        () => '#DB5858',
                        num => num.toString(),
                        num => num
                    );
                    gauge.setDataValue(kenki);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }, {
            shortName: 'meditation',
            displayName: 'Meditation',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: extraDataDiscreteGaugeRenderer<SAMExtraData>((_, extra) => {
                const meditation = extra.gauge.meditation;
                const children = [];

                for (let i = 1; i <= 3; i++) {
                    children.push(quickElement('span', [i <= meditation ? 'sam-meditation-gauge-full' : 'sam-meditation-gauge-default']));
                }

                return children;
            }),
        }, {
            shortName: 'sen',
            displayName: 'Sen',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: extraDataDiscreteGaugeRenderer<SAMExtraData>((_, extra) => {
                const sen = extra.gauge.sen;
                const children: HTMLElement[] = [];

                const senStyles: StyleSwitcher = {
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
                    },
                };

                Object.keys(senStyles).forEach(key => {
                    const stack = document.createElement('span');
                    for (const [k, v] of Object.entries(senStyles[key])) {
                        stack.style[k as WritableCssProp] = v;
                    }
                    // stack.style.height = '100%';
                    // stack.style.width = '16px';
                    // stack.style.display = 'inline-block';
                    // stack.style.overflow = 'hidden';
                    if (!sen.has(key)) {
                        stack.style.background = '#00000033';
                    }
                    children.push(stack);
                });
                return children;
            }),
        }];
    }

    override makeCustomConfigInterface(settings: SamSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const ppField = new FieldBoundFloatField(settings, "prePullMeikyo", {inputMode: 'number'});
        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labelFor("Meikyo Pre-Pull Time:", ppField));
        configDiv.appendChild(ppField);
        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));
        return configDiv;
    }

}
