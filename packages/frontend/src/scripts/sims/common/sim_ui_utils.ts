import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CellRenderer} from "@xivgear/common-ui/table/tables";
import {DisplayRecordFinalized} from "@xivgear/core/sims/cycle_sim";
import {quickElement} from "@xivgear/common-ui/components/util";

export function gaugeRenderer<X>(inner: (usedAbility: PreDmgUsedAbility, extra: X) => HTMLElement[]): CellRenderer<DisplayRecordFinalized, PreDmgUsedAbility | undefined | null> {
    return (used: PreDmgUsedAbility | undefined | null) => {
        if (used?.extraData !== undefined) {
            return quickElement('div', ['icon-gauge-holder'], inner(used, used.extraData as X));
        }
        else {
            return document.createTextNode('');
        }
    };
}
