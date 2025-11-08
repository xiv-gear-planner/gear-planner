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
        const descriptionText = 'This shows the compatibility of the selected set with all other sets in the sheet. ' +
            '"Compatible" means that if the same item is used on both sets, that the same materia is installed on both sets. ' +
            'If the item is not unique, then it is considered "soft incompatible" - you can still assemble both sets, but you will need duplicate items. ';
        const description = el('div', {class: 'description'}, [descriptionText]);
        const setsToCompare = sheet.sets.filter(otherSet => otherSet !== baseSet);
        if (setsToCompare.length === 0) {
            const msg = el('div', {class: 'no-sets-to-compare'}, [
                'No other sets to compare against.',
            ]);
            this.contentArea.replaceChildren(descriptionText, msg);
        }
        else {
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
                            return makeActionButton([icon, `${issueCount} issue${issueCount > 1 ? 's' : ''}`], () => {
                                new CompatCheckerSetModal(value).attachAndShowTop();
                            });
                            // return el('div', {class: 'set-compat-bad'}, [
                            //     icon,
                            //     btn,
                            // ]);
                        }
                    },
                }),
            ];
            table.data = [new HeaderRow(), ...setsToCompare];
            this.contentArea.replaceChildren(description, table);
        }
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
            col({
                displayName: 'Issue Type',
                shortName: 'issuetype',
                getter: (incomp: SlotIncompatibility) => incomp.reason,
                renderer: reason => {
                    let text: string;
                    switch (reason) {
                        case 'materia-mismatch':
                            text = 'Materia Mismatch';
                            break;
                        case 'relic-stat-mismatch':
                            text = 'Relic Stat Mismatch';
                            break;
                        default:
                            text = 'Other';
                    }
                    return el('div', {class: 'issue-type'}, [text]);
                },
            }),
            col({
                displayName: 'Detail',
                shortName: 'detail',
                getter: (incomp: SlotIncompatibility) => incomp.subIssues,
                renderer: subIssues => {
                    return el('div', {class: 'sub-issues-list'},
                        subIssues.map(iss => el('div', {class: 'sub-issue'}, [iss]))
                    );
                },
            }),
        ];
        table.data = [new HeaderRow(), ...data.incompatibleSlots];
        this.contentArea.replaceChildren(table);
        this.addCloseButton();
    }
}

customElements.define('compat-checker-overview-modal', CompatCheckerOverviewModal);
customElements.define('compat-checker-set-modal', CompatCheckerSetModal);

