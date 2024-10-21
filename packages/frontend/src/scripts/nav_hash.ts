import {
    HASH_QUERY_PARAM,
    NO_REDIR_HASH,
    parsePath,
    PATH_SEPARATOR,
    splitHashLegacy,
    splitPath
} from "@xivgear/core/nav/common_nav";
import {displayEmbedError, earlyEmbedInit} from "./embed";
import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {getBisSheet} from "@xivgear/core/external/static_bis";

import {
    formatTopMenu,
    hideWelcomeArea,
    openExport,
    openSheetByKey,
    setMainContent,
    showImportSheetForm,
    showLoadingScreen, showNewSheetForm,
    showSheetPickerMenu
} from "./base_ui";

let expectedHash: string[] | undefined = undefined;

let embed = false;


/**
 * Determine if two arrays have equal members. Not a deep equals - only inspects one level.
 *
 * @param left The first array
 * @param right The second array
 */
export function arrayEq(left: unknown[] | undefined, right: unknown[] | undefined) {
    if (left === undefined && right === undefined) {
        return true;
    }
    if (left === undefined || right === undefined) {
        return false;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Get the current page path
 */
export function getCurrentHash() {
    return [...expectedHash,];
}

/**
 * Shim to handle old-style URLs
 */
export async function processHashLegacy() {
    const newHash = location.hash;
    const split = splitHashLegacy(newHash);
    formatTopMenu(split);
    if (split.length > 0) {
        console.log('processHashLegacy', newHash);
        // This path allows certain things such as /viewset/<json> to continue to use the old-style hash, since the
        // URL query param method causes the whole thing to be too long of a URL for the server to handle.
        if (split[0] === NO_REDIR_HASH) {
            await doNav(split.slice(1));
        }
        else {
            goHash(...split);
            location.hash = "";
        }
    }
}

/**
 * Process a potential change in hash.
 *
 * Note that unlike the old hash-based method, there is no catch-all listener for hash changes. Rather, anything
 * wishing to change the hash should use {@link goHash} to have the navigation automatically performed (if the
 * entire desired state can be determined from the path alone), or {@link setHash} if you wish to set the location
 * but manually replace the page contents.
 */
export async function processNav() {
    // Remove the literal #
    // let hash = splitHash(location.hash);
    const path = getQueryParams().get(HASH_QUERY_PARAM) ?? '';
    const pathParts = splitPath(path);
    formatTopMenu(pathParts);
    console.info("processQuery", pathParts);
    if (pathParts.length > 0) {
        hideWelcomeArea();
    }
    if (arrayEq(pathParts, expectedHash)) {
        console.info("Ignoring internal query change");
        return;
    }
    expectedHash = pathParts;
    await doNav(pathParts);
}

async function doNav(pathParts: string[]) {
    const nav = parsePath(pathParts);
    if (nav === null) {
        console.error('unknown nav', pathParts);
        showSheetPickerMenu();
        return;
    }
    if (nav['embed']) {
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
            openExport(json, false, true);
            return;
        }
        else {
            console.error('Non-existent shortlink, or other error', uuid);
            // TODO: better error display for non-embed
            if (isEmbed) {
                displayEmbedError("That set/sheet does not seem to exist.");
            }
        }
        break;
    }
    case "setjson":
        openExport(nav.jsonBlob as SetExport, false, nav.viewOnly);
        return;
    case "sheetjson":
        openExport(nav.jsonBlob as SheetExport, false, nav.viewOnly);
        return;
    case "bis": {
        showLoadingScreen();
        try {
            const resolved: string | null = await getBisSheet(nav.job, nav.expac, nav.sheet);
            if (resolved) {
                const json = JSON.parse(resolved);
                openExport(json, false, true);
                return;
            }
            else {
                console.error('Non-existent bis, or other error', [nav.job, nav.expac, nav.sheet,]);
            }
        }
        catch (e) {
            console.error("Error loading bis", e);
        }
        const errMsg = document.createElement('h1');
        errMsg.textContent = 'Error Loading Sheet/Set';
        setMainContent('Error', errMsg);
        return;
    }
    }
    console.error("I don't know what to do with this path", pathParts);
    // TODO: handle remaining invalid cases
}

function getQueryParams(): URLSearchParams {
    return new URLSearchParams(location.search);
}

function manipulateUrlParams(action: (params: URLSearchParams) => void) {
    const params = getQueryParams();
    const before = params.toString();
    action(params);
    const after = params.toString();
    if (before !== after) {
        history.pushState(null, null, '?' + params.toString());
    }
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
 * @param hashParts The path parts, e.g. for 'foo|bar', use ['foo', 'bar'] as the argument.
 */
export function setHash(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    expectedHash = [...hashParts,];
    console.log("New hash parts", hashParts);
    const hash = hashParts.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    // location.hash = '#' + hashParts.map(part => '/' + encodeURIComponent(part)).join('');
    // console.log(location.hash);
    manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, hash));
    // TODO: there are redundant calls to this
    formatTopMenu(expectedHash);
    if (hashParts.length > 0) {
        hideWelcomeArea();
    }
}

export function getHash(): string[] | undefined {
    return expectedHash;
}

/**
 * Change the path of the current URL. Does not perform the actual navigation (i.e. the page contents will not be
 * changed). This will, however, update the state of the top menu - that is, if you navigate to the 'new sheet' page,
 * then the 'New Sheet' button will be active.
 *
 * This method is useful for when the entire page state can be determined from the path alone, and you don't need to
 * override any behavior.
 *
 * @param hashParts The path parts, e.g. for 'foo|bar', use ['foo', 'bar'] as the argument.
 */
export function goHash(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    const hash = hashParts.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, hash));
    processNav();
}

export function isEmbed(): boolean {
    return embed;
}
