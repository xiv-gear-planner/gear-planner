import {HASH_QUERY_PARAM, parsePath, PATH_SEPARATOR} from "@xivgear/core/nav/common_nav";
import {earlyEmbedInit} from "./embed";
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

export function getCurrentHash() {
    return [...expectedHash];
}

export function splitHashLegacy(input: string) {
    return (input.startsWith("#") ? input.substring(1) : input).split('/').filter(item => item).map(item => decodeURIComponent(item))
}

export function splitPath(input: string) {
    return (input.startsWith(PATH_SEPARATOR) ? input.substring(1) : input).split(PATH_SEPARATOR).filter(item => item).map(item => decodeURIComponent(item))
}

export async function processHashLegacy() {
    const newHash = location.hash;
    if (splitHashLegacy(newHash).length > 0) {
        console.log('processHashLegacy', newHash);
        manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, newHash));
        location.hash = "";
    }
}

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
                    console.error('Non-existent bis, or other error', [nav.job, nav.expac, nav.sheet]);
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

// This is referred to as 'hash' because the app originally used the hash, but later changed to using a query parameter
export function setHash(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    expectedHash = [...hashParts];
    console.log("New hash parts", hashParts);
    const hash = hashParts.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    // location.hash = '#' + hashParts.map(part => '/' + encodeURIComponent(part)).join('');
    // console.log(location.hash);
    manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, hash));
    // TODO: there are redundant calls to this
    formatTopMenu(expectedHash);
}

export function getHash(): string[] | undefined {
    return expectedHash;
}

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