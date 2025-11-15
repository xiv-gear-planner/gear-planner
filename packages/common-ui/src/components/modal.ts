import {el, makeActionButton} from "./util";
import {Modal, MODAL_CONTROL} from "../modalcontrol";
import {LoadingBlocker} from "./loader";
import {makeCloseButton} from "./icons";

export abstract class BaseModal extends HTMLElement {
    protected readonly header: HTMLElement;
    protected readonly inner: HTMLDivElement;
    protected readonly closeButton: HTMLButtonElement;
    protected readonly buttonArea: HTMLDivElement;
    protected readonly contentArea: HTMLDivElement;
    private loadingBlocker: LoadingBlocker | null = null;

    protected constructor() {
        super();
        this.classList.add('modal-dialog', 'base-modal-dialog');
        this.header = el('h2', {class: 'modal-header'});
        this.contentArea = el('div', {class: 'modal-content-area'});
        this.buttonArea = el('div', {classes: ['lower-button-area', 'modal-lower-button-area']});
        this.closeButton = makeActionButton([makeCloseButton()], () => {
            this.close();
        }, 'Close');
        this.closeButton.classList.add('modal-close-button');
        this.inner = el('div', {class: 'modal-inner'}, [
            this.closeButton,
            this.header,
            this.contentArea,
            this.buttonArea,
        ]);
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

    protected addCloseButton(label: string = 'Close') {
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

    protected showLoadingBlocker() {
        if (this.loadingBlocker === null) {
            this.loadingBlocker = new LoadingBlocker();
            this.loadingBlocker.classList.add('with-bg', 'base-modal-loading-blocker');
            this.loadingBlocker.style.position = 'absolute';
            this.loadingBlocker.style.inset = '0 0 0 0';
            this.inner.appendChild(this.loadingBlocker);
        }
        this.loadingBlocker.show();
    }

    protected hideLoadingBlocker(): void {
        this.loadingBlocker?.hide();
    }

    protected get loadingBlockerVisible(): boolean {
        return this.loadingBlocker?.isVisible() ?? false;
    }

    protected set loadingBlockerVisible(visible: boolean) {
        if (visible) {
            this.showLoadingBlocker();
        }
        else {
            this.hideLoadingBlocker();
        }
    }

    protected showLoadingBlockerWhile<X extends Promise<unknown>>(action: () => X): X {
        this.showLoadingBlocker();
        const promise = action();
        promise.finally(() => this.hideLoadingBlocker());
        return promise;
    }


}
