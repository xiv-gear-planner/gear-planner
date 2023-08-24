import {LoadingBlocker} from "./loader";
import {closeModal, setModal} from "../modalcontrol";
import {putShortLink} from "../external/shortlink_server";

let modalInstance: ShortlinkModal | undefined = undefined;

export function startShortLink(shortlinkData: string) {
    if (!modalInstance) {
        const newInst = new ShortlinkModal();
        document.querySelector('body').appendChild(newInst);
        modalInstance = newInst;
    }
    modalInstance.show(shortlinkData);
}

export class TextCopyDisplay extends HTMLElement {

    private readonly textBox: HTMLInputElement;
    private readonly copyButton: HTMLButtonElement;

    constructor(copyData: string) {
        super();
        this.textBox = document.createElement('input');
        this.textBox.type = 'text';
        this.textBox.readOnly = true;
        this.textBox.value = copyData;

        this.copyButton = document.createElement('button');
        this.copyButton.textContent = 'Copy';
        this.copyButton.addEventListener('click', () => navigator.clipboard.writeText(copyData));

        this.replaceChildren(this.textBox, this.copyButton);
    }
}

export class ShortlinkModal extends HTMLElement {
    private readonly loader: LoadingBlocker;
    private readonly closeButton: HTMLButtonElement;
    private readonly inner: HTMLDivElement;

    constructor() {
        super();


        this.inner = document.createElement('div');
        this.inner.classList.add('modal-inner');

        this.loader = new LoadingBlocker();
        this.closeButton = document.createElement('button');
        this.closeButton.textContent = 'Close';
        this.closeButton.addEventListener('click', () => closeModal());

        this.inner.replaceChildren(this.loader, this.closeButton);
        this.appendChild(this.inner);
    }

    show(shortlinkData: string) {
        this.inner.replaceChildren(this.loader, this.closeButton);
        this.loader.show();
        this.style.display = 'flex';
        const outer = this;
        setModal({
            element: this.inner,
            close() {
                outer.hide();
            }
        })
        putShortLink(shortlinkData).then(link => this.showData(link), err => {
            console.error(err);
            this.showError(err);
        });
    }

    private showData(shortlink: URL) {
        const textCopyDisplay = new TextCopyDisplay(shortlink.toString());
        this.inner.replaceChildren(textCopyDisplay, this.closeButton);
    }

    private showError(e: Error) {
        this.loader.hide();
        const errorDisplay = document.createElement('h1');
        errorDisplay.textContent = 'Error';
        this.inner.replaceChildren(errorDisplay, this.closeButton);
    }

    private hide() {
        this.inner.replaceChildren();
        this.style.display = 'none';
    }
}

customElements.define('shortlink-modal', ShortlinkModal);
customElements.define('text-copy-display', TextCopyDisplay);
