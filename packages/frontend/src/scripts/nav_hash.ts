import {BIS_HASH, EMBED_HASH, SHORTLINK_HASH, VIEW_SET_HASH, VIEW_SHEET_HASH} from "@xivgear/core/nav/common_nav";
import {earlyEmbedInit} from "./embed";
import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {getBisSheet} from "@xivgear/core/external/static_bis";
import {JobName} from "@xivgear/xivmath/xivconstants";

import {
    formatTopMenu, hideWelcomeArea,
    openExport,
    openSheetByKey, setMainContent,
    showImportSheetForm,
    showLoadingScreen,
    showNewSheetForm, showSheetPickerMenu
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

export function splitHash(input: string) {
    return (input.startsWith("#") ? input.substring(1) : input).split('/').filter(item => item).map(item => decodeURIComponent(item))
}

export async function processHash() {
    // Remove the literal #
    let hash = splitHash(location.hash);
    formatTopMenu(hash);
    console.info("processHash", hash);
    if (hash.length > 0) {
        hideWelcomeArea();
    }
    if (arrayEq(hash, expectedHash)) {
        console.info("Ignoring internal hash change");
        return;
    }
    expectedHash = hash;

    if (hash.length === 0) {
        console.info("No sheet open");
        showSheetPickerMenu();
    }
    else {
        if (hash[0] === EMBED_HASH) {
            earlyEmbedInit();
            embed = true;
            hash = hash.slice(1);
        }
        else {
            embed = false;
        }
        const mainNav = hash[0];
        if (hash.length >= 2 && mainNav === "sheet") {
            const sheetKey = hash[1];
            console.log("Loading: " + sheetKey);
            openSheetByKey(sheetKey);
        }
        else if (mainNav === "newsheet") {
            showNewSheetForm();
        }
        else if (mainNav === "importsheet" || mainNav === VIEW_SHEET_HASH) {
            if (hash.length === 1) {
                showImportSheetForm();
            }
            else {
                const json = hash.slice(1).join('/');
                const parsed = JSON.parse(decodeURI(json)) as SheetExport;
                openExport(parsed, false, mainNav === VIEW_SHEET_HASH);
            }
        }
        else if (mainNav === "importset" || mainNav === VIEW_SET_HASH) {
            if (hash.length >= 2) {
                const json = hash.slice(1).join('/');
                const parsed = JSON.parse(decodeURI(json)) as SetExport;
                openExport(parsed, false, mainNav === VIEW_SET_HASH);
            }
        }
        else if (mainNav === SHORTLINK_HASH) {
            showLoadingScreen();
            if (hash.length >= 2) {
                const shortLink = hash[1];
                try {
                    const resolved: string | null = await getShortLink(shortLink);
                    if (resolved) {
                        const json = JSON.parse(resolved);
                        openExport(json, false, true);
                        return;
                    }
                    else {
                        console.error('Non-existent shortlink, or other error', shortLink);
                    }
                }
                catch (e) {
                    console.error("Error loading shortlink", e);
                }
                const errMsg = document.createElement('h1');
                errMsg.textContent = 'Error Loading Sheet/Set';
                setMainContent('Error', errMsg);
            }
        }
        else if (mainNav === BIS_HASH) {
            showLoadingScreen();
            if (hash.length >= 4) {
                const job = hash[1];
                const expac = hash[2];
                const sheetName = hash[3];
                try {
                    const resolved: string | null = await getBisSheet(job as JobName, expac, sheetName);
                    if (resolved) {
                        const json = JSON.parse(resolved);
                        openExport(json, false, true);
                        return;
                    }
                    else {
                        console.error('Non-existent bis, or other error', [job, expac, sheetName]);
                    }
                }
                catch (e) {
                    console.error("Error loading bis", e);
                }
                const errMsg = document.createElement('h1');
                errMsg.textContent = 'Error Loading Sheet/Set';
                setMainContent('Error', errMsg);
            }
        }
        else {
            console.error("I don't know what to do with this path", hash);
        }
    }
    // TODO: handle remaining invalid cases
}

export function setHash(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
        }
    }
    expectedHash = [...hashParts];
    console.log("New hash parts", hashParts);
    location.hash = '#' + hashParts.map(part => '/' + encodeURIComponent(part)).join('');
    console.log(location.hash);
}

export function getHash(): string[] | undefined {
    return expectedHash;
}

// function goHash(...hashParts: string[]) {
//     for (const hashPart of hashParts) {
//         if (hashPart === undefined) {
//             console.error(new Error("Undefined url hash part!"), hashParts);
//         }
//     }
//     console.log("New hash parts", hashParts);
//     location.hash = '#' + hashParts.map(part => '/' + encodeURIComponent(part)).join('');
//     console.log(location.hash);
// }

export function isEmbed(): boolean {
    return embed;
}