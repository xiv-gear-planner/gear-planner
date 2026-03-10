import {showChunkLoadErrorDialog} from "../components/chunk_load_error_modal";

/**
 * Wraps a promise from async import() or other critical load such as the web worker.
 * On any rejection, shows a dialog and rethrows so callers see a failed promise.
 * The dialog allows you to ignore the error and continue anyway, or reload the page with
 * the cache busting parameter.
 * This should not be used in cases where there is already a try/catch mechanism in place, such
 * as the privacy modal which simply displays the error where the text would be.
 */
export function wrapChunkLoad<T>(promise: Promise<T>): Promise<T> {
    return promise.catch((reason: unknown) => {
        showChunkLoadErrorDialog();
        throw reason;
    });
}
