import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {CustomColumnSpec} from "@xivgear/common-ui/table/tables";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {MnkSettings, MnkSimResult} from "@xivgear/core/sims/melee/mnk/mnk_sim";
import {MNKExtraData} from "@xivgear/core/sims/melee/mnk/mnk_types";
import {quickElement} from "@xivgear/common-ui/components/util";
import {gaugeRenderer} from "../../common/sim_ui_utils";

export class MnkSimGui extends BaseMultiCycleSimGui<MnkSimResult, MnkSettings> {

    protected extraAbilityUsedColumns(_: MnkSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [
            {
                shortName: 'chakra',
                displayName: 'Chakra',
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: gaugeRenderer<MNKExtraData>((_, extra) => {
                    const chakra = extra.gauge.chakra;
                    const children = [];
                    for (let i = 1; i < 6; i++) {
                        if (i <= chakra - 5) {
                            children.push(quickElement('span', ['mnk-chakra-gauge-red'], []));
                        }
                        else if (i <= chakra) {
                            children.push(quickElement('span', ['mnk-chakra-gauge-orange'], []));
                        }
                        else {
                            children.push(quickElement('span', ['mnk-chakra-gauge-default'], []));
                        }
                    }
                    children.push(quickElement('span', ['mnk-chakra-gauge-number'], [`${chakra.toLocaleString(undefined, {minimumFractionDigits: 3})}`]));
                    return children;
                }),
            },
            {
                shortName: 'fury',
                displayName: "Beast Fury",
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: gaugeRenderer<MNKExtraData>((_, extra) => {
                    const gauge = extra.gauge;
                    const opoFury = gauge.opoFury;
                    const raptorFury = gauge.raptorFury;
                    const coeurlFury = gauge.coeurlFury;

                    const children = [];

                    for (let i = 0; i < 1; i++) {
                        children.push(quickElement('span', [i < opoFury ? 'mnk-beastfury-gauge-opo' : 'mnk-beastfury-gauge-default'], []));
                    }
                    for (let i = 0; i < 1; i++) {
                        children.push(quickElement('span', [i < raptorFury ? 'mnk-beastfury-gauge-raptor' : 'mnk-beastfury-gauge-default'], []));
                    }
                    for (let i = 0; i < 2; i++) {
                        children.push(quickElement('span', [i < coeurlFury ? 'mnk-beastfury-gauge-coeurl' : 'mnk-beastfury-gauge-default'], []));
                    }

                    return children;
                }),
            },
            {
                shortName: 'nadi',
                displayName: "Nadi",
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: gaugeRenderer<MNKExtraData>((_, extra) => {
                    const lNadi = extra.gauge.lunarNadi;
                    const sNadi = extra.gauge.solarNadi;

                    const children = [];

                    for (let i = 0; i < 1; i++) {
                        children.push(quickElement('span', [i < lNadi ? 'mnk-nadi-gauge-lunar' : 'mnk-nadi-gauge-default'], []));
                    }

                    for (let i = 0; i < 1; i++) {
                        children.push(quickElement('span', [i < sNadi ? 'mnk-nadi-gauge-solar' : 'mnk-nadi-gauge-default'], []));
                    }

                    return children;
                }),
            }, {
                shortName: 'beastChakra',
                displayName: "Beast Chakra",
                getter: used => isFinalizedAbilityUse(used) ? used.original : null,
                renderer: gaugeRenderer<MNKExtraData>((_, extra) => {
                    const chakra = extra.gauge.beastChakra;
                    const children = [];
                    for (let i = 0; i < 3; i++) {
                        switch (chakra[i]) {
                            case "opo":
                                children.push(quickElement('span', ['mnk-beastchakra-gauge-opo'], []));
                                break;
                            case "raptor":
                                children.push(quickElement('span', ['mnk-beastchakra-gauge-raptor'], []));
                                break;
                            case "coeurl":
                                children.push(quickElement('span', ['mnk-beastchakra-gauge-coeurl'], []));
                                break;
                            default:
                                children.push(quickElement('span', ['mnk-beastchakra-gauge-default'], []));
                        }
                    }
                    return children;
                }),
            },
        ];
    }

}
