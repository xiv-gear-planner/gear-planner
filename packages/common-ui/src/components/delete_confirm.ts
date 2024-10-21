/**
 * Ask for confirmation to delete something.
 *
 * The confirmation can be bypassed by holding 'alt' while clicking the button.
 *
 * @param event The event (so that modifiers can be checked). Must have a boolean property 'altKey'.
 * @param message The message to ask the user. Do not include the 'hold alt to bypass' notice.
 * @returns true if the user confirms, or if alt was held to bypass confirmation. false if alt was not held and the user
 * backed out.
 */
export function confirmDelete(event: {
    altKey: boolean
}, message: string): boolean {
    if (event.altKey) {
        return true;
    }
    else {
        return confirm(message + '\n\nYou can bypass this by holding "alt" while clicking the delete button.');
    }
}
