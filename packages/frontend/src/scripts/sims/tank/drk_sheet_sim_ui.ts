import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {DrkSettings, DrkSimResult} from "@xivgear/core/sims/tank/drk/drk_sheet_sim";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {col, CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {DrkExtraData} from "@xivgear/core/sims/tank/drk/drk_types";
import {GaugeNoText, GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class DrkSimGui extends BaseMultiCycleSimGui<DrkSimResult, DrkSettings> {

    protected extraAbilityUsedColumns(_: DrkSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'bloodGauge',
            displayName: 'Blood',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const blood = (usedAbility.extraData as DrkExtraData).gauge.blood;

                    const gauge = new GaugeWithText<number>(
                        num => num >= 50 ? '#e5004e' : '#660929',
                        num => num.toString(),
                        num => num
                    );
                    gauge.setDataValue(blood);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'darkside',
            displayName: 'Darkside',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const darksideDuration = (usedAbility.extraData as DrkExtraData).darksideDuration;
                    const gauge = new GaugeWithText<number>(
                        () => '#f913bc',
                        num => `${num}s`,
                        num => num / 60 * 100
                    );
                    gauge.setDataValue(darksideDuration);
                    gauge.classList.add('sim-gauge', 'three-digit');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'darkArts',
            displayName: 'Dark Arts',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const darkArts = (usedAbility.extraData as DrkExtraData).gauge.darkArts;
                    const gauge = new GaugeNoText<boolean>(
                        () => '#fffd30',
                        active => active ? 100 : 0
                    );
                    gauge.setDataValue(darkArts);
                    gauge.classList.add('sim-gauge', 'gauge-narrow');
                    return gauge;
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'mp',
            displayName: 'MP',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const mp = (usedAbility.extraData as DrkExtraData).gauge.mp;
                    const gauge = new GaugeWithText<number>(
                        () => '#df5591',
                        num => num.toString(),
                        num => num / 10000 * 100
                    );
                    gauge.classList.add('sim-gauge', 'five-digit');
                    gauge.setDataValue(mp);
                    return gauge;
                }
                return document.createTextNode("");
            },
        })];
    }

    override makeCustomConfigInterface(settings: DrkSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));

        const prepullTBNCB = new FieldBoundCheckBox(settings, "prepullTBN");

        configDiv.appendChild(labeledCheckbox("Use The Blackest Night prepull", prepullTBNCB));
        return configDiv;
    }

}
