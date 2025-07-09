import {BaseModal} from "@xivgear/common-ui/components/modal";
import {SheetHandle} from "@xivgear/core/persistence/saved_sheets";
import {makeActionButton, quickElement} from "@xivgear/common-ui/components/util";

export class ConflictResolutionDialog extends BaseModal {

    private currentSheet: SheetHandle;
    private keepLocalButton: HTMLButtonElement;
    private keepRemoteButton: HTMLButtonElement;
    private saveAsButton: HTMLButtonElement;

    constructor(sheet: SheetHandle) {
        super();
        this.headerText = 'Conflict Resolution';
        this.keepLocalButton = this.addActionButton('Keep Local', () => {
            this.currentSheet.conflictResolutionStrategy = 'keep-local';
            this.done();
        });
        this.keepRemoteButton = this.addActionButton('Keep Remote', () => {
            this.currentSheet.conflictResolutionStrategy = 'keep-remote';
            this.done();
        });
        this.saveAsButton = this.addActionButton('Save Local As...', () => {
            alert('not implemented'); // TODO
            // this.currentSheet.saveLocalAsDefault();
            // this.currentSheet.conflictResolutionStrategy = 'keep-local';
            // this.done();
        });
        this.addCloseButton('Cancel');
        this.setSheet(sheet);
    }

    setSheet(sheet: SheetHandle) {
        this.currentSheet = sheet;
        const topText = `The set '${sheet.name}' has been modified on multiple devices. You can choose to discard your local changes, discard the remote changes, or save your local changes as a new sheet.`;
        const left = conflictSubArea('Local', sheet.meta.localDeleted);
        const right = conflictSubArea('Remote', sheet.meta.serverDeleted);
        const mid = quickElement('div', ['conflict-resolution-mid'], [left, right]);
        this.contentArea.replaceChildren(topText, mid);
    }

    done() {
        // TODO: have it immediately sync the current sheet
        // TODO: this should move to the next sheet
        this.close();
    }
}

function conflictSubArea(label: string, deleted: boolean): HTMLDivElement {
    const header = quickElement('h3', [], [label]);
    const text = quickElement('p', [], [deleted ? 'Deleted' : 'Modified']);
    return quickElement('div', [], [header, text]);
}

customElements.define('conflict-resolution-dialog', ConflictResolutionDialog);

