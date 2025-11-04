import {BaseModal} from "@xivgear/common-ui/components/modal";
import {GearPlanSheet, SetCompatibilityReport, SlotIncompatibility} from "@xivgear/core/sheet";
import {CharacterGearSet} from "@xivgear/core/gear";
import {col, CustomTable, HeaderRow} from "@xivgear/common-ui/table/tables";
import {el, makeActionButton} from "@xivgear/common-ui/components/util";
import {errorIcon, warningIcon} from "@xivgear/common-ui/components/icons";

export function showCompatOverview(sheet: GearPlanSheet, set: CharacterGearSet) {
    new CompatCheckerOverviewModal(sheet, set).attachAndShowExclusively();
}

class CompatCheckerOverviewModal extends BaseModal {
    constructor(sheet: GearPlanSheet, baseSet: CharacterGearSet) {
        super();
        this.headerText = 'Compatibility Checker';
        const table = new CustomTable<CharacterGearSet>();
        table.columns = [
            col({
                displayName: 'Set',
                shortName: 'set',
                getter: set => set.name,
            }),
            // TODO: job column for multi-job?
            col({
                displayName: 'Compatibility',
                shortName: 'compat-result',
                getter: setB => sheet.checkCompatibility(baseSet, setB),
                renderer: (value: SetCompatibilityReport, rowValue) => {
                    // show button to allow details to be opened
                    if (value.compatibilityLevel === 'compatible') {
                        return el('div', {class: 'set-compat-good'}, [
                            'No issues',
                        ]);

                    }
                    else {
                        let icon: SVGSVGElement;
                        if (value.compatibilityLevel === 'soft-incompatible') {
                            icon = warningIcon();
                            icon.classList.add('warning');
                        }
                        else {
                            icon = errorIcon();
                            icon.classList.add('error');
                        }
                        const issueCount = value.incompatibleSlots.length;
                        const btn = makeActionButton([icon, `${issueCount} issue${issueCount > 1 ? 's' : ''}`], () => {
                            new CompatCheckerSetModal(value).attachAndShowTop();
                        });
                        return btn;
                        // return el('div', {class: 'set-compat-bad'}, [
                        //     icon,
                        //     btn,
                        // ]);
                    }
                },
            }),
        ];
        const setsToCompare = sheet.sets.filter(otherSet => otherSet !== baseSet);
        table.data = [new HeaderRow(), ...setsToCompare];
        this.contentArea.replaceChildren(table);
        this.addCloseButton();
    }
}

class CompatCheckerSetModal extends BaseModal {
    constructor(data: SetCompatibilityReport) {
        super();
        this.headerText = `${data.setA.name} vs ${data.setB.name}`;
        const table = new CustomTable<SlotIncompatibility>();
        table.columns = [
            col({
                displayName: 'Slot',
                shortName: 'slot',
                getter: incomp => incomp.slotKey,
            }),
            // TODO: job column for multi-job?
            col({
                displayName: 'Issue',
                shortName: 'issue',
                getter: (incomp: SlotIncompatibility) => incomp.detail,
            }),
        ];
        table.data = data.incompatibleSlots;
        this.contentArea.replaceChildren(table);
        this.addCloseButton();
    }
}

customElements.define('compat-checker-overview-modal', CompatCheckerOverviewModal);
customElements.define('compat-checker-set-modal', CompatCheckerSetModal);

