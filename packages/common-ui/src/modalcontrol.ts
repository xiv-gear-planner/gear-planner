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
     * If true, does not allow the modal to be closed by clicking off of the modal.
     */
    explicitCloseOnly?: boolean;
}

let currentModal: Modal | undefined = undefined;

/**
 * Set the current modal. Always closes the current modal. If the new modal is undefined, does not open a new modal.
 *
 * @param modal
 */
export function setModal(modal: Modal | undefined) {
    if (currentModal) {
        currentModal.close();
    }
    if (modal) {
        document.addEventListener('mousedown', listener);
    }
    else {
        document.removeEventListener('mousedown', listener);
    }
    currentModal = modal;
}

export function closeModal() {
    setModal(undefined);
}

export function getModal() {
    return currentModal;
}

const listener = (ev: MouseEvent) => {
    if (!currentModal) {
        return;
    }
    else {
        if (currentModal.explicitCloseOnly) {
            return;
        }
        const modalElement = currentModal.modalElement;
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
        setModal(undefined);
        ev.stopPropagation();
    }
};
