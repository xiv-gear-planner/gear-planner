import {FieldBoundDataSelect, labelFor, quickElement} from "@xivgear/common-ui/components/util";
import {potionOptionsDropdown} from "../common/sim_ui_utils";
import {PctOpener, PctSettings, PctSimResult} from "@xivgear/sims/caster/pct/pct_sheet_sim";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/sims/cycle_sim";
import {col, CustomColumn} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {PctGaugeState} from "@xivgear/sims/caster/pct/pct_types";
import {GaugeWithText} from "@xivgear/common-ui/components/gauges";

export class PctSimGui extends BaseMultiCycleSimGui<PctSimResult, PctSettings> {

    protected extraAbilityUsedColumns(result: CycleSimResult): CustomColumn<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'palette',
            displayName: 'Palette',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<PctGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }
                const palette = usedAbility.gaugeAfter.palette;
                const gauge = new GaugeWithText<number>(
                    () => '#c45bff',
                    val => val.toString(),
                    val => val
                );
                gauge.setDataValue(palette);
                gauge.classList.add('sim-gauge');
                return gauge;
            },
        }), col({
            shortName: 'paint',
            displayName: 'Paint',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<PctGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }
                const gauge = usedAbility.gaugeAfter;
                const children = [];
                for (let i = 1; i <= 5; i++) {
                    let cls: string;
                    if (i > gauge.paint) {
                        cls = 'pct-paint-default';
                    }
                    else if (gauge.monochrome && i === gauge.paint) {
                        cls = 'pct-paint-black';
                    }
                    else {
                        cls = 'pct-paint-white';
                    }
                    children.push(quickElement('span', [cls], []));
                }
                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }), col({
            shortName: 'canvas',
            displayName: 'Canvas',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<PctGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }
                const gauge = usedAbility.gaugeAfter;
                const creature = quickElement('span', [gauge.creatureCanvas !== null ? 'pct-canvas-creature' : 'pct-canvas-default'], []);
                creature.title = gauge.creatureCanvas !== null ? `Creature: ${gauge.creatureCanvas}` : `Creature: empty (next: ${gauge.nextCreature})`;
                const hammer = quickElement('span', [gauge.hammerCanvas ? 'pct-canvas-hammer' : 'pct-canvas-default'], []);
                hammer.title = gauge.hammerCanvas ? 'Hammer: painted' : 'Hammer: empty';
                const starry = quickElement('span', [gauge.starryCanvas ? 'pct-canvas-starry' : 'pct-canvas-default'], []);
                starry.title = gauge.starryCanvas ? 'Starry Sky: painted' : 'Starry Sky: empty';
                return quickElement('div', ['icon-gauge-holder'], [creature, hammer, starry]);
            },
        }), col({
            shortName: 'portrait',
            displayName: 'Portrait',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<PctGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }
                const portrait = usedAbility.gaugeAfter.portrait;
                let cls: string;
                switch (portrait) {
                    case 'mog':
                        cls = 'pct-portrait-mog';
                        break;
                    case 'madeen':
                        cls = 'pct-portrait-madeen';
                        break;
                    default:
                        cls = 'pct-portrait-default';
                }
                const span = quickElement('span', [cls], []);
                span.title = portrait === null ? 'No portrait' : portrait === 'mog' ? 'Mog of the Ages' : 'Retribution of the Madeen';
                return quickElement('div', ['icon-gauge-holder'], [span]);
            },
        })];
    }

    override makeCustomConfigInterface(settings: PctSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const openerDropdown = new FieldBoundDataSelect<PctSettings, PctOpener>(
            settings,
            'opener',
            option => {
                switch (option) {
                    case '2nd-gcd':
                        return '2nd GCD Starry Opener';
                    case '3rd-gcd':
                        return '3rd GCD Starry Opener';
                    default:
                        return option;
                }
            },
            ['2nd-gcd', '3rd-gcd']
        );
        const openerLabel = labelFor('Opener:', openerDropdown);
        openerLabel.style.display = 'block';
        configDiv.appendChild(quickElement('div', [], [openerLabel, openerDropdown]));

        configDiv.appendChild(potionOptionsDropdown(settings));

        return configDiv;
    }
}
