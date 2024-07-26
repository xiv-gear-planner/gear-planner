export function confirmDelete(event: MouseEvent, message: string): boolean {
    if (event.altKey) {
        return true;
    }
    else {
        return confirm(message + '\n\nYou can bypass this by holding "alt" while clicking the delete button.');
    }
}