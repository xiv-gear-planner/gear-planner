import {closeModal, setModal} from "../modalcontrol";
import {makeActionButton, makeCloseButton} from "./util";

export abstract class BaseModal extends HTMLElement {
    protected readonly header: HTMLElement;
    private readonly inner: HTMLDivElement;
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
        const closeButton = makeActionButton([makeCloseButton()], () => {
            this.close();
        }, 'Close');
        closeButton.classList.add('modal-close-button');
        this.inner.appendChild(closeButton);
        this.inner.appendChild(this.header);
        this.inner.appendChild(this.contentArea);
        this.inner.appendChild(this.buttonArea);
        this.appendChild(this.inner);
    }

    protected addButton(button: HTMLElement) {
        this.buttonArea.appendChild(button);
    }

    protected addActionButton(label: string, action: (ev: MouseEvent) => void) {
        this.addButton(makeActionButton(label, action));
    }

    protected addCloseButton() {
        this.addActionButton('Close', () => this.close());
    }

    set headerText(text: string) {
        this.header.textContent = text;
    }

    attachAndShow() {
        document.querySelector('body').appendChild(this);
        this.show();
    }

    show() {
        const outer = this;
        setModal({
            element: outer.inner,
            close() {
                outer.remove()
            }
        })
        setTimeout(() => this.classList.add('backdrop-active'), 5);
    }

    close() {
        closeModal();
    }
}