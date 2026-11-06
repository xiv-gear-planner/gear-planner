/**
 * Model for a modal dialog. Does not need to inherit BaseModal.
 */
export interface Modal {
    /**
     * Callback to be called when the modal is closed
     */
    close(): void;

    /**
     * The modal element.
     */
    modalElement: HTMLElement;

    /**
     * If true, does not allow the modal to be closed with Escape or by clicking off of the modal.
     */
    explicitCloseOnly?: boolean;
}

/**
 * Controls general modal state. This is NOT tightly integrated with BaseModal because some modals do not use
 * BaseModal, such as the materia pickers. More specifically, this class does not handle any of the actual rendering
 * of a modal. Modals are expected to attack themselves to the DOM in a reasonable way, and to provide a method to
 * force-close them.
 *
 * This treats modals as a stack. You can do five main operations:
 * 1. Set a modal, replacing the entire stack, closing any existing modals.
 * 2. Set nothing, clearing the stack, closing any existing modals.
 * 3. Push a modal onto the stack, leaving existing modals open.
 * 4. Pop a modal off the stack, closing it.
 * 5. Remove a specific modal off the stack, closing it (even if it is not the topmost modal).
 *
 */
export class ModalControl {
    private modalStack: Modal[] = [];

    private readonly listener: (ev: MouseEvent) => void;
    private readonly keyListener: (ev: KeyboardEvent) => void;

    constructor() {
        this.listener = (ev: MouseEvent) => this.handleMouseClick(ev);
        this.keyListener = (ev: KeyboardEvent) => this.handleKeyDown(ev);
    }

    /**
     * Set the current modal. Always closes any current modals. In other words, the modal stack is replaced with this
     * modal, or cleared if the argument is undefined.
     *
     * @param modal
     */
    setModal(modal: Modal | undefined) {
        if (this.modalStack.length > 0) {
            this.modalStack.forEach(m => m.close());
        }
        if (modal) {
            this.modalStack = [modal];
        }
        else {
            this.modalStack = [];
        }
        this.resetListenerState();
    }

    /**
     * Close all open modals.
     */
    closeAll() {
        this.setModal(undefined);
    }

    /**
     * Close a specific modal.
     *
     * @param modal The modal to close. Must be an exact match (i.e. reference equality).
     */
    close(modal: Modal) {
        const index = this.modalStack.lastIndexOf(modal);
        if (index >= 0) {
            this.modalStack[index].close();
            const currentIndex = this.modalStack.lastIndexOf(modal);
            if (currentIndex >= 0) {
                this.modalStack.splice(currentIndex, 1);
            }
        }
        this.resetListenerState();
    }

    /**
     * Remove a modal that was closed outside of ModalControl, without calling its close callback.
     */
    removeClosedModal(modal: Modal) {
        const index = this.modalStack.lastIndexOf(modal);
        if (index >= 0) {
            this.modalStack.splice(index, 1);
        }
        this.resetListenerState();
    }

    /**
     * Get the topmost modal, or undefined if there are no modals.
     *
     * @returns The topmost modal, or undefined if there are no modals.
     *
     */
    private get topmostModal(): Modal | undefined {
        return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : undefined;
    }

    /**
     * Push a modal onto the stack. This will become the new topmost modal. Existing modals will not be closed.
     *
     * @param modal
     */
    pushModal(modal: Modal) {
        this.modalStack.push(modal);
        this.resetListenerState();
    }

    /**
     * Pop the topmost modal off the stack and close it. If there are no modals, this does nothing.
     *
     * @returns The modal that was popped off the stack, or undefined if there were no modals.
     *
     */
    private popModal(): Modal | undefined {
        const modal = this.modalStack.pop();
        if (modal !== undefined) {
            modal.close();
        }
        this.resetListenerState();
        return modal;
    }

    private resetListenerState() {
        // Reset to known good state
        document.removeEventListener('mousedown', this.listener);
        document.removeEventListener('keydown', this.keyListener);
        if (this.topmostModal) {
            document.addEventListener('mousedown', this.listener);
            document.addEventListener('keydown', this.keyListener);
        }
    }

    private handleMouseClick(ev: MouseEvent) {
        const modal = this.topmostModal;
        if (!modal) {
            return;
        }
        else {
            if (modal.explicitCloseOnly) {
                return;
            }
            const modalElement = modal.modalElement;
            if (modalElement.tagName === 'DIALOG') {
                if (ev.target === modalElement) {
                    // A click on a native dialog itself is a click on its backdrop.
                    this.popModal();
                    ev.stopPropagation();
                }
                return;
            }
            if (!(ev.target instanceof HTMLElement)) {
                return;
            }
            let eventTarget: HTMLElement | null = ev.target;
            while (eventTarget) {
                if (modalElement === eventTarget) {
                    // Click was on the modal. Ignore.
                    return;
                }
                else {
                    eventTarget = eventTarget.parentElement;
                }
            }
            this.popModal();
            ev.stopPropagation();
        }
    }

    private handleKeyDown(ev: KeyboardEvent) {
        // We only care about Esc
        // If the Esc is captured by something like an open dropdown, then we never actually get this event.
        if (ev.key !== 'Escape' || ev.defaultPrevented) {
            return;
        }
        const modal = this.topmostModal;
        if (!modal) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        if (!modal.explicitCloseOnly && !ev.repeat) {
            this.popModal();
        }
    }
}

export const MODAL_CONTROL = new ModalControl();

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        modalControl?: ModalControl;
    }
}

window.modalControl = MODAL_CONTROL;
