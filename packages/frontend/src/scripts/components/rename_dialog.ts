import {closeModal} from "../modalcontrol";
import {quickElement} from "./util";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseModal} from "./modal";
import {GearPlanSheet} from "@xivgear/core/sheet";

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
        }
    });
    startRename(modal);
}

export function startRenameSet(set: CharacterGearSet) {
    const modal = new RenameModal(set);
    startRename(modal);
}

function startRename(modal: RenameModal) {
    document.querySelector('body').appendChild(modal);
    modal.show();
}

class RenameModal extends BaseModal {
    private readonly nameInput: HTMLInputElement;
    private readonly descriptionInput: HTMLTextAreaElement;
    private readonly applyButton: HTMLButtonElement;
    private readonly cancelButton: HTMLButtonElement;

    constructor(private itemBeingRenamed: { name: string, description: string }) {
        super();

        this.headerText = 'Sheet Name/Description';

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'Sheet Name';
        this.nameInput.value = itemBeingRenamed.name ?? '';

        this.descriptionInput = document.createElement('textarea');
        this.descriptionInput.placeholder = 'You can enter a description here';
        this.descriptionInput.value = itemBeingRenamed.description ?? '';

        this.applyButton = document.createElement('button');
        this.applyButton.textContent = 'Apply';
        this.applyButton.type = 'submit';
        this.applyButton.addEventListener('click', () => this.apply());
        // this.applyButton.addEventListener('click', () => this.apply());

        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', () => closeModal());

        const form = quickElement('form', [], [
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
        closeModal();
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }
}

customElements.define('rename-dialog', RenameModal);