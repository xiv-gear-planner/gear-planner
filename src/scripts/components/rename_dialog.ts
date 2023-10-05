import {GearPlanSheet} from "../components";
import {closeModal, setModal} from "../modalcontrol";
import {quickElement} from "./util";
import {CharacterGearSet} from "../gear";

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

class RenameModal extends HTMLElement {
    private header: HTMLHeadingElement;
    private nameInput: HTMLInputElement;
    private descriptionInput: HTMLTextAreaElement;
    private applyButton: HTMLButtonElement;
    private cancelButton: HTMLButtonElement;
    private inner: HTMLElement;

    constructor(private itemBeingRenamed: { name: string, description: string }) {
        super();

        this.header = document.createElement('h2');
        this.header.textContent = 'Sheet Name/Description';

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

        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', () => closeModal());

        this.inner = quickElement('div', ['sheet-name-modal', 'modal-inner'],
            [
                this.header,
                this.nameInput,
                this.descriptionInput,
                quickElement('div', ['button-area'], [this.applyButton, this.cancelButton])

            ]);
        this.replaceChildren(this.inner);
    }

    show() {
        const outer: RenameModal = this;
        setModal({
            element: outer,
            close() {
                outer.remove();
            }
        });
        // this.style.dis
    }

    apply() {
        this.itemBeingRenamed.name = this.nameInput.value;
        this.itemBeingRenamed.description = this.descriptionInput.value;
        closeModal();
    }
}

customElements.define('rename-dialog', RenameModal);