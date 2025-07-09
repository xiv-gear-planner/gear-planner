import {makeActionButton, makeCloseButton} from "./util";
import {Modal, MODAL_CONTROL} from "../modalcontrol";

export abstract class BaseModal extends HTMLElement {
    protected readonly header: HTMLElement;
    protected readonly inner: HTMLDivElement;
    protected readonly closeButton: HTMLButtonElement;
    protected readonly buttonArea: HTMLDivElement;
    protected readonly contentArea: HTMLDivElement;

    protected constructor() {
        super();
        this.classList.add('modal-dialog', 'base-modal-dialog');
        this.inner = document.createElement('div');
        this.inner.classList.add('modal-inner');
        this.header = document.createElement('h2');
        this.header.classList.add('modal-header');
        this.contentArea = document.createElement('div');
        this.contentArea.classList.add('modal-content-area');
        this.buttonArea = document.createElement('div');
        this.buttonArea.classList.add('lower-button-area', 'modal-lower-button-area');
        this.closeButton = makeActionButton([makeCloseButton()], () => {
            this.close();
        }, 'Close');
        this.closeButton.classList.add('modal-close-button');
        this.inner.appendChild(this.closeButton);
        this.inner.appendChild(this.header);
        this.inner.appendChild(this.contentArea);
        this.inner.appendChild(this.buttonArea);
        this.appendChild(this.inner);
    }

    protected addButton(button: HTMLElement) {
        this.buttonArea.appendChild(button);
    }

    protected addActionButton(label: string, action: (ev: MouseEvent) => void): HTMLButtonElement {
        const button = makeActionButton(label, action);
        this.addButton(button);
        return button;
    }

    protected addCloseButton(label: string = 'close') {
        return this.addActionButton(label, () => this.close());
    }

    private _modalWrapper: Modal | undefined = undefined;
    /**
     * Represents this as a {@link Modal} object.
     * @private
     */
    private get modalWrapper(): Modal {
        if (this._modalWrapper !== undefined) {
            return this._modalWrapper;
        }
        const outer = this;
        return this._modalWrapper = {
            get explicitCloseOnly(): boolean {
                return outer.explicitCloseOnly;
            },
            modalElement: this.inner,
            close(): void {
                outer.onClose();
                outer.remove();
            },
        };
    }

    get explicitCloseOnly(): boolean {
        return false;
    }

    // eslint-disable-next-line accessor-pairs
    set headerText(text: string) {
        this.header.textContent = text;
    }

    attachAndShowExclusively() {
        document.querySelector('body')?.appendChild(this);
        this.showExclusively();
    }

    attachAndShowTop() {
        document.querySelector('body')?.appendChild(this);
        this.showTop();
    }

    showExclusively() {
        MODAL_CONTROL.setModal(this.modalWrapper);
        setTimeout(() => this.classList.add('backdrop-active'), 5);
    }

    showTop() {
        MODAL_CONTROL.pushModal(this.modalWrapper);
        setTimeout(() => this.classList.add('backdrop-active'), 5);
    }

    close() {
        MODAL_CONTROL.close(this.modalWrapper);
    }

    protected onClose(): void {
    }
}
