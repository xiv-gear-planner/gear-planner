/**
 * Check whether the page is loaded in a frame.
 *
 * @returns true if in a frame, false if top-level.
 */
export function isInIframe(): boolean {
    try {
        return window.parent !== window;
    }
    catch (e) {
        console.error("Error checking for iframe", e);
    }
    return true;
}
