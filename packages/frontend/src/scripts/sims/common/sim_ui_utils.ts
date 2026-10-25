import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CellRenderer} from "@xivgear/common-ui/table/tables";
import {DisplayRecordFinalized} from "@xivgear/sims/cycle_sim";
import {FieldBoundDataSelect, labelFor, quickElement} from "@xivgear/common-ui/components/util";
import {PotionEnableOption, PotionOptions} from "@xivgear/sims/common/medicine";

export function potionOptionsDropdown(settings: PotionOptions): HTMLElement {
    const dropdown = new FieldBoundDataSelect<PotionOptions, PotionEnableOption>(
        settings,
        'usePotion',
        option => {
            switch (option) {
                case 'auto':
                    return 'Use Selected Potion';
                case false:
                    return 'Do Not Use Potion';
                case true:
                    return 'Use Legacy Potion Logic';
                default:
                    return option;
            }
        },
        ['auto', false, true]
    );
    const label = labelFor('Potion Usage:', dropdown);
    label.style.display = 'block';
    return quickElement('div', ['potion-setting-control'], [label, dropdown]);
}

export function extraDataDiscreteGaugeRenderer<X>(inner: (usedAbility: PreDmgUsedAbility, extra: X) => HTMLElement[]): CellRenderer<DisplayRecordFinalized, PreDmgUsedAbility | undefined | null> {
    return (used: PreDmgUsedAbility | undefined | null) => {
        if (used?.extraData !== undefined) {
            return quickElement('div', ['icon-gauge-holder'], inner(used, used.extraData as X));
        }
        else {
            return document.createTextNode('');
        }
    };
}
