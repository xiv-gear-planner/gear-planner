import {el, makeActionButton} from "./util";
import {Modal, MODAL_CONTROL} from "../modalcontrol";
import {LoadingBlocker} from "./loader";
import {makeCloseButton} from "./icons";

export abstract class BaseModal extends HTMLElement {
    protected readonly dialog: HTMLDialogElement;
    protected readonly header: HTMLElement;
    protected readonly inner: HTMLDivElement;
    protected readonly closeButton: HTMLButtonElement;
    protected readonly buttonArea: HTMLDivElement;
    protected readonly contentArea: HTMLDivElement;
    private loadingBlocker: LoadingBlocker | null = null;
    private closedByControl = false;

    protected constructor() {
        super();
        this.classList.add('modal-dialog', 'base-modal-dialog');
        this.dialog = el('dialog');
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
        this.dialog.appendChild(this.inner);
        this.appendChild(this.dialog);
        this.dialog.addEventListener('cancel', ev => {
            ev.preventDefault();
        });
        this.dialog.addEventListener('close', () => this.handleDialogClosed());
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
            modalElement: this.dialog,
            close(): void {
                if (outer.closedByControl) {
                    return;
                }
                outer.closedByControl = true;
                outer.onClose();
                outer.dialog.close();
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
        this.showDialog();
    }

    showTop() {
        MODAL_CONTROL.pushModal(this.modalWrapper);
        this.showDialog();
    }

    close() {
        MODAL_CONTROL.close(this.modalWrapper);
    }

    protected onClose(): void {
    }

    private showDialog() {
        this.closedByControl = false;
        if (!this.dialog.open) {
            this.dialog.showModal();
        }
    }

    private handleDialogClosed() {
        if (this.closedByControl || this.dialog.open) {
            return;
        }
        this.closedByControl = true;
        this.onClose();
        MODAL_CONTROL.removeClosedModal(this.modalWrapper);
        this.remove();
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

export abstract class FormModal extends BaseModal {
    protected readonly form: HTMLFormElement;
    protected readonly submitButton: HTMLButtonElement;
    protected readonly cancelButton: HTMLButtonElement;

    protected constructor(protected readonly submitButtonLabel: string, cancelButtonLabel: string = 'Cancel') {
        super();
        this.form = el('form', {class: 'base-modal-form'});
        this.form.append(this.contentArea, this.buttonArea);
        this.inner.appendChild(this.form);
        this.form.addEventListener('submit', ev => {
            ev.preventDefault();
            this.submit();
        });

        this.submitButton = el('button', {props: {type: 'submit'}}, [this.submitButtonLabel]);
        this.addButton(this.submitButton);
        this.cancelButton = makeActionButton(cancelButtonLabel, () => {
            void this.cancel();
        });
        this.addButton(this.cancelButton);
    }

    protected abstract submit(): void;

    protected cancel(): void | Promise<void> {
        this.close();
    }
}

export type ChoiceDialogOption<T> = {
    label: string,
    value: T,
}

export abstract class ChoiceDialog<T> extends BaseModal {
    private readonly resultPromise: Promise<T>;
    private readonly hasCloseValue: boolean;
    private readonly closeValue: T | undefined;
    private resolveResult!: (value: T | PromiseLike<T>) => void;
    private rejectResult!: (reason: unknown) => void;
    private settled = false;

    protected constructor(choices: readonly ChoiceDialogOption<T>[], closeValue?: T) {
        super();
        this.hasCloseValue = arguments.length > 1;
        this.closeValue = closeValue;
        this.resultPromise = new Promise<T>((resolve, reject) => {
            this.resolveResult = resolve;
            this.rejectResult = reject;
        });
        if (!this.hasCloseValue) {
            this.closeButton.style.display = 'none';
        }
        choices.forEach(choice => {
            this.addActionButton(choice.label, () => this.choose(choice.value));
        });
    }

    static ask<T>(createDialog: () => ChoiceDialog<T>): Promise<T> {
        const dialog = createDialog();
        const result = dialog.resultPromise;
        dialog.attachAndShowTop();
        return result;
    }

    private choose(value: T) {
        if (this.settled) {
            return;
        }
        this.settled = true;
        this.resolveResult(value);
        this.close();
    }

    protected onClose(): void {
        if (this.settled) {
            return;
        }
        this.settled = true;
        if (this.hasCloseValue) {
            this.resolveResult(this.closeValue as T);
        }
        else {
            this.rejectResult(new Error('Choice dialog closed before a choice was made.'));
        }
    }
}
