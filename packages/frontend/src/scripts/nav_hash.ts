import {
    HASH_QUERY_PARAM,
    NavState,
    NO_REDIR_HASH,
    ONLY_SET_QUERY_PARAM,
    parsePath,
    PATH_SEPARATOR,
    SELECTION_INDEX_QUERY_PARAM,
    splitHashLegacy,
    splitPath,
    tryParseOptionalIntParam
} from "@xivgear/core/nav/common_nav";
import {earlyEmbedInit} from "./embed";
import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {getBisIndexAt, getBisSheet} from "@xivgear/core/external/static_bis";

import {
    formatTopMenu,
    hideWelcomeArea,
    openExport,
    openSheetByKey,
    setMainContent,
    showFatalError,
    showImportSheetForm,
    showLoadingScreen,
    showNewSheetForm,
    showSheetPickerMenu
} from "./base_ui";
import {recordError} from "@xivgear/common-ui/analytics/analytics";
import {BisBrowser} from "./components/bisbrowser/bis_browser";
import {cleanUrlParams, getQueryParams, manipulateUrlParams} from "@xivgear/common-ui/nav/common_frontend_nav";
import {PopoutEditor} from "./components/sheet/editor/popout_editor";
import {openPopout} from "./popout";

// let expectedHash: string[] | undefined = undefined;


let expectedState: NavState = new NavState(["$$$UNINITIALIZED$$$"], undefined, undefined);

let embed = false;


export function getCurrentHash() {
    return expectedState.path;
}

/**
 * Get the current navigation state, or undefined if it has not been processed yet.
 */
export function getCurrentState(): NavState {
    return expectedState;
}

/**
 * Shim to handle old-style URLs
 */
export async function processHashLegacy() {
    const newHash = location.hash;
    const split = splitHashLegacy(newHash);
    const state = new NavState(split, undefined, undefined);
    formatTopMenu(state);
    if (split.length > 0) {
        console.log('processHashLegacy', newHash);
        // This path allows certain things such as /viewset/<json> to continue to use the old-style hash, since the
        // URL query param method causes the whole thing to be too long of a URL for the server to handle.
        if (split[0] === NO_REDIR_HASH) {
            // The actual list is prefixed with the NO_REDIR_HASH, indicating that it should be stripped and not redirected.
            const trueState = new NavState(split.splice(1), undefined, undefined);
            await doNav(trueState);
        }
        else {
            // Otherwise, redirect to a new-style hash
            goPath(...split);
            location.hash = "";
        }
    }
}

/**
 * Process a potential change in navigation state. This compares the current URL to the last URL seen by this method.
 * If there is a different, it will replace the content area with the new desired page.,
 *
 * Note that unlike the old hash-based method, there is no catch-all listener for hash changes. Rather, anything
 * wishing to change the hash should use {@link goPath} to have the navigation automatically performed (if the
 * entire desired state can be determined from the path alone), or {@link setPath} if you wish to set the location
 * but manually replace the page contents.
 */
export async function processNav() {
    // Rewrite %7C to | in-place
    window.history.replaceState(null, "", cleanUrlParams(document.location.search));
    // Remove the literal #
    // let hash = splitHash(location.hash);
    const qp = getQueryParams();
    const path = qp.get(HASH_QUERY_PARAM) ?? '';
    const osIndex = tryParseOptionalIntParam(qp.get(ONLY_SET_QUERY_PARAM));
    const selIndex = tryParseOptionalIntParam(qp.get(SELECTION_INDEX_QUERY_PARAM));
    const pathParts = splitPath(path);
    const newNav = new NavState(pathParts, osIndex, selIndex);
    formatTopMenu(newNav);
    console.info("processQuery", newNav);
    if (pathParts.length > 0) {
        hideWelcomeArea();
    }
    if (expectedState.isEqual(newNav)) {
        console.info("Ignoring internal nav change");
        return;
    }
    expectedState = newNav;
    await doNav(newNav);
}

/**
 * doNav takes a desired NavState and renders the new "page".
 *
 * @param navState
 */
async function doNav(navState: NavState) {
    try {
        const nav = parsePath(navState);
        if (nav === null) {
            console.error('unknown nav', navState);
            showSheetPickerMenu();
            return;
        }
        if ('embed' in nav && nav.embed) {
            embed = true;
            earlyEmbedInit();
        }
        if (nav.type !== 'mysheets') {
            hideWelcomeArea();
        }
        switch (nav.type) {
            case "mysheets":
                console.info("No sheet open");
                showSheetPickerMenu();
                return;
            case "newsheet":
                showNewSheetForm();
                return;
            case "importform":
                showImportSheetForm();
                return;
            case "saved": {
                const saveKey = nav.saveKey;
                console.log("Loading: " + saveKey);
                openSheetByKey(saveKey);
                return;
            }
            case "shortlink": {
                showLoadingScreen();
                const uuid = nav.uuid;
                const resolved: string | null = await getShortLink(uuid);
                if (resolved) {
                    const json = JSON.parse(resolved);
                    openExport(json, true, nav.onlySetIndex, nav.defaultSelectionIndex);
                    return;
                }
                else {
                    console.error('Non-existent shortlink, or other error', uuid);
                    recordError('load', {
                        'type': 'uuidDoesNotExist',
                        'uuid': uuid,
                    });
                    showFatalError("That set/sheet does not seem to exist");
                    return;
                }
            }
            case "setjson":
                openExport(nav.jsonBlob as SetExport, nav.viewOnly, undefined, undefined);
                return;
            case "sheetjson":
                openExport(nav.jsonBlob as SheetExport, nav.viewOnly, undefined, undefined);
                return;
            case "bis": {
                showLoadingScreen();
                try {
                    const resolved: string | null = await getBisSheet(nav.path);
                    if (resolved) {
                        const json = JSON.parse(resolved);
                        openExport(json, true, nav.onlySetIndex, nav.defaultSelectionIndex);
                        return;
                    }
                    else {
                        console.error('Non-existent bis, or other error', nav.path);
                        recordError("load", `Non-existent bis, or other error: ${nav.path.join("|")}`);
                    }
                }
                catch (e) {
                    console.error("Error loading bis", e);
                    recordError("load", e);
                    showFatalError("Error loading BiS sheet");
                }
                showFatalError("Error loading BiS sheet");
                return;
            }
            case 'bisbrowser': {
                showLoadingScreen();
                try {
                    // TODO: have it display a placeholder component until loaded
                    const current = await getBisIndexAt(nav.path);
                    if (current.type === 'error') {
                        showFatalError(current.reason);
                        return;
                    }
                    else if (current.type === 'file') {
                        showFatalError(`Path ${current.pathPart} is a file, not a directory`);
                        return;
                    }
                    const bisBrowserElement = new BisBrowser((path, nav) => {
                        if (nav) {
                            goPath(...path);
                        }
                        else {
                            setPath(...path);
                        }
                    });
                    bisBrowserElement.setData(current);
                    setMainContent('BiS', bisBrowserElement.element);
                }
                catch (e) {
                    console.error(e);
                    showFatalError('Error Loading BiS Index');
                }
                return;
            }
            case 'popup': {
                // TODO: validate not null
                const sheet = window.parentSheet;
                const editor = new PopoutEditor(sheet, nav.index);
                openPopout(editor);
                return;
            }
        }
    }
    catch (e) {
        console.error(e);
        recordError('doNav', e);
        showFatalError("navigation error");
        return;
    }
    console.error("I don't know what to do with this path", navState);
    showFatalError("This does not seem to be a valid page");
}


/**
 * Like {@link #setNav}, but takes only the ?page path parts.
 *
 * @param pathParts The parts of the ?path parameter.
 */
export function setPath(...pathParts: string[]) {
    setNav(new NavState(pathParts, undefined, undefined));
}

/**
 * Change the path of the current URL. Does not perform the actual navigation (i.e. the page contents will not be
 * changed). This will, however, update the state of the top menu - that is, if you navigate to the 'new sheet' page,
 * then the 'New Sheet' button will be active.
 *
 * As such, this method should be used when you plan to change the contents of the page yourself, which is necessary
 * for some paths. For example, when importing a sheet, the 'imported' path does not contain the actual sheet data
 * nor anything that would lead to it, so it must use this method.
 *
 * @param newState The new navigation state to assume.
 */
export function setNav(newState: NavState) {
    const hashParts = newState.path;
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    expectedState = newState;
    console.log("New hash parts", hashParts);
    const hash = hashParts.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, hash));
    // TODO: there are redundant calls to this
    formatTopMenu(newState);
    if (hashParts.length > 0) {
        hideWelcomeArea();
    }
}

/**
 * Get the current nav, but only the ?page path parts. Or undefined if it cannot be determined.
 */
export function getHash(): string[] {
    return getCurrentState().path;
}

/**
 * Navigate to a new URL. This is like {@link #goNav}, but takes just the "page" parameter as a list instead of a
 * delimited string. This does perform navigation - you should not attempt to perform navigation yourself if you are
 * using this method.
 *
 * This method is useful for when the entire page state can be determined from the path alone, and you don't need to
 * override any behavior.
 *
 * @param hashParts The path parts, e.g. for 'foo|bar', use ['foo', 'bar'] as the argument.
 */
export function goPath(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    goNav(new NavState(hashParts, undefined, undefined));
}

/**
 * Given a NavState, change the page URL to that nav. This performs actual navigation. You should not attempt to perform
 * navigation yourself if you are using this method.
 *
 * @param nav
 */
export function goNav(nav: NavState) {
    const encodedPath = nav.encodedPath;
    manipulateUrlParams(params => {
        params.set(HASH_QUERY_PARAM, encodedPath);
        if (nav.onlySetIndex === undefined) {
            params.delete(ONLY_SET_QUERY_PARAM);
        }
        else {
            params.set(ONLY_SET_QUERY_PARAM, nav.onlySetIndex?.toString());
        }
        if (nav.selectIndex === undefined) {
            params.delete(SELECTION_INDEX_QUERY_PARAM);
        }
        else {
            params.set(SELECTION_INDEX_QUERY_PARAM, nav.selectIndex?.toString());
        }
    });
    processNav();
}

/**
 * Whether not the current navigation state is an embed.
 */
export function isEmbed(): boolean {
    return embed;
}
