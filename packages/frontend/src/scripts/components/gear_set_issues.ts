import {BaseModal} from "@xivgear/common-ui/components/modal";
import {CharacterGearSet} from "@xivgear/core/gear";
import {errorIcon, quickElement, warningIcon} from "@xivgear/common-ui/components/util";
import {GearSetIssue} from "@xivgear/xivmath/geartypes";


export function gearSetErrorIcon() {
    const icon = errorIcon();
    icon.classList.add('gear-set-error-icon');
    return icon;
}

export function gearSetWarningIcon() {
    const icon = warningIcon();
    icon.classList.add('gear-set-warning-icon');
    return icon;
}

export function iconForIssues(...issues: GearSetIssue[]) {
    if (issues.find(issue => issue.severity === 'error')) {
        return gearSetErrorIcon();
    }
    else {
        return gearSetWarningIcon();
    }
}

export class SetIssuesModal extends BaseModal {
    // future TODO: this would also be a good place to add a UI for warning suppression.
    constructor(set: CharacterGearSet) {
        super();
        this.headerText = 'Issues';
        const issues = set.issues;
        if (issues.length > 0) {
            this.classList.add('has-issues');
            for (const issue of issues) {
                this.contentArea.appendChild(quickElement('div', ['gear-set-issue-block'], [
                    iconForIssues(issue),
                    quickElement('span', [], [issue.description])
                ]));
            }
        }
        else {
            this.classList.add('no-issues');
            const text = document.createTextNode('This set has no issues.');
            this.contentArea.appendChild(text);
        }
        this.addCloseButton();
    }
}

customElements.define('gear-set-issues-modal', SetIssuesModal);
