function doubleClickHandler(event: MouseEvent) {
    // Prevent double click text selection but only if it's not an interactive element
    if (event.target && !('value' in event.target)) {
        event.preventDefault();
    }
}
export function installDoubleClickHandler() {
    document.addEventListener("dblclick", doubleClickHandler);
    document.addEventListener("mousedown", e => {
        if (e.detail >= 2) {
            doubleClickHandler(e);
        }
    });
}

