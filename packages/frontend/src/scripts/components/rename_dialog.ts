import {closeModal} from "@xivgear/common-ui/modalcontrol";
import {labeledCheckbox, quickElement} from "@xivgear/common-ui/components/util";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {GearPlanSheet} from "@xivgear/core/sheet";

enum RenameSetSheetType {
    set = 'Set',
    sheet = 'Sheet',
}

export function startRenameSheet(sheet: GearPlanSheet) {
    const modal = new RenameModal({
        get name() {
            return sheet.sheetName;
        },
        set name(name) {
            sheet.sheetName = name;
        },
        get description() {
            return sheet.description;
        },
        set description(desc) {
            sheet.description = desc;
        },
        get recommended() {
            return false;
        },
        set recommended(rec) {
            // no-op for sheets
        },
    },  RenameSetSheetType.sheet);
    startRename(modal);
}

export function startRenameSet(set: CharacterGearSet) {
    const modal = new RenameModal(set, RenameSetSheetType.set);
    startRename(modal);
}

function startRename(modal: RenameModal) {
    document.querySelector('body').appendChild(modal);
    modal.show();
}

class RenameModal extends BaseModal {
    private readonly nameInput: HTMLInputElement;
    private readonly descriptionInput: HTMLTextAreaElement;
    private readonly recommendedInput: HTMLInputElement;
    private readonly applyButton: HTMLButtonElement;
    private readonly cancelButton: HTMLButtonElement;

    constructor(private itemBeingRenamed: { name: string, description: string, recommended: boolean, }, setSheetType: RenameSetSheetType) {
        super();

        if (setSheetType === RenameSetSheetType.set) {
            this.headerText = `Set Properties`;
        }
        else {
            this.headerText = `Sheet Name/Description`;
        }

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = `${setSheetType} Name`;
        this.nameInput.value = itemBeingRenamed.name ?? '';

        this.descriptionInput = document.createElement('textarea');
        this.descriptionInput.placeholder = 'You can enter a description here';
        this.descriptionInput.value = itemBeingRenamed.description ?? '';

        this.recommendedInput = document.createElement('input');
        this.recommendedInput.type = 'checkbox';
        this.recommendedInput.checked = itemBeingRenamed.recommended;
        const recommendedCheckbox = labeledCheckbox('Recommended Set', this.recommendedInput);

        this.applyButton = document.createElement('button');
        this.applyButton.textContent = 'Apply';
        this.applyButton.type = 'submit';
        this.applyButton.addEventListener('click', () => this.apply());

        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', () => closeModal());

        // Only show recommendedCheckbox for sets, not sheets
        const form = quickElement('form', [], setSheetType === RenameSetSheetType.set ? [
            this.nameInput,
            this.descriptionInput,
            recommendedCheckbox,
        ] : [
            this.nameInput,
            this.descriptionInput,
        ]);
        this.contentArea.appendChild(form);
        this.addButton(this.applyButton);
        this.addButton(this.cancelButton);
        form.addEventListener('submit', ev => this.apply(ev));

    }

    apply(ev?: SubmitEvent) {
        this.itemBeingRenamed.name = this.nameInput.value;
        this.itemBeingRenamed.description = this.descriptionInput.value;
        this.itemBeingRenamed.recommended = this.recommendedInput.checked;
        closeModal();
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }
}

customElements.define('rename-dialog', RenameModal);
