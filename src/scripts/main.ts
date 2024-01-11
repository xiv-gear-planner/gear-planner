import {GearPlanSheet, ImportSheetArea, NewSheetForm, SheetPickerTable} from "./components";
import {SetExport, SheetExport} from "./geartypes";
import {quickElement} from "./components/util";
import {getShortLink} from "./external/shortlink_server";
import {getBisSheet} from "./external/static_bis";
import {JobName} from "./xivconstants";
import {LoadingBlocker} from "./components/loader";
import {earlyEmbedInit, openEmbed} from "./embed";

export const SHORTLINK_HASH = 'sl';
export const SHARE_LINK = 'https://share.xivgear.app/share/';
export const BIS_HASH = 'bis';

export const VIEW_SHEET_HASH = 'viewsheet';

export const contentArea = document.getElementById("content-area");
// export const midBarArea = document.getElementById("mid-controls-area");
export const topMenuArea = document.getElementById("dev-menu-area");
const editorArea = document.getElementById("editor-area");

export const welcomeArea = document.getElementById("welcome-message");
export const welcomeCloseButton = document.getElementById("welcome-close-button");

async function initialLoad() {
    processHash();
    handleWelcomeArea();
}

function handleWelcomeArea() {
    if (expectedHash?.length > 0) {
        // hideWelcomeArea();
    }
    else {
        const hideWelcomeAreaSettingKey = 'hide-welcome-area';
        if (localStorage.getItem(hideWelcomeAreaSettingKey) == 'true') {
            hideWelcomeArea();
        }
        else {
            welcomeCloseButton.addEventListener('click', () => {
                localStorage.setItem(hideWelcomeAreaSettingKey, 'true');
                hideWelcomeArea();
            })
        }
    }
}

function hideWelcomeArea() {
    welcomeArea.style.display = 'none';
}

let expectedHash: string[] | undefined = undefined;

function arrayEq(left: any[] | undefined, right: any[] | undefined) {
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

function setMainContent(title: string, ...nodes) {
    contentArea.replaceChildren(...nodes);
    setTitle(title);
}

let embed = false;

async function processHash() {
    // Remove the literal #
    let hash = (location.hash.startsWith("#") ? location.hash.substring(1) : location.hash).split('/').filter(item => item).map(item => decodeURIComponent(item));
    console.info("processHash", hash);
    if (hash.length > 0) {
        hideWelcomeArea();
    }
    if (arrayEq(hash, expectedHash)) {
        console.info("Ignoring internal hash change")
        return;
    }
    expectedHash = hash;
    if (hash.length === 0) {
        console.info("No sheet open");
        showSheetPickerMenu();
    }
    else {
        if (hash[0] === "embed") {
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
        else if (mainNav === "importsheet" || mainNav === "viewsheet") {
            if (hash.length === 1) {
                showImportSheetForm();
            }
            else {
                const json = hash.slice(1).join('/');
                const parsed = JSON.parse(decodeURI(json)) as SheetExport;
                openExport(parsed, false, mainNav === "viewsheet");
            }
        }
        else if (mainNav === "importset" || mainNav === "viewset") {
            if (hash.length >= 2) {
                const json = hash.slice(1).join('/');
                const parsed = JSON.parse(decodeURI(json)) as SetExport;
                openExport(parsed, false, mainNav === "viewset");
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

export function showLoadingScreen() {
    setMainContent('Loading...', new LoadingBlocker());
}

export function showNewSheetForm() {
    setHash('newsheet');
    const form = new NewSheetForm(openSheet);
    setMainContent('New Sheet', form);
    form.takeFocus();
}

export function showImportSheetForm() {
    setHash('importsheet')
    setMainContent('Import Sheet', new ImportSheetArea(async sheet => {
        openSheet(sheet, false);
        setHash('imported');
    }));
}

const pageTitle = 'XivGear - FFXIV Gear Planner';

export function setTitle(titlePart: string | undefined) {
    if (titlePart === undefined) {
        document.title = pageTitle;
    }
    else {
        document.title = titlePart + ' - ' + pageTitle;
    }
}

function setHash(...hashParts: string[]) {
    for (let hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
        }
    }
    expectedHash = [...hashParts];
    console.log("New hash parts", hashParts);
    location.hash = '#' + hashParts.map(part => '/' + encodeURIComponent(part)).join('');
    console.log(location.hash);
}

function getHash(): string[] | undefined {
    return expectedHash;
}

function goHash(...hashParts: string[]) {
    for (let hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
        }
    }
    console.log("New hash parts", hashParts);
    location.hash = '#' + hashParts.map(part => '/' + encodeURIComponent(part)).join('');
    console.log(location.hash);
}

export async function openSheetByKey(sheet: string) {
    // TODO: handle nonexistent sheet
    setTitle('Loading Sheet');
    console.log('openSheetByKey: ', sheet);
    const planner = GearPlanSheet.fromSaved(sheet);
    if (planner) {
        await openSheet(planner);
        setTitle(planner.sheetName);
    }
    else {
        contentArea.replaceChildren(document.createTextNode("That sheet does not exist."));
        setTitle('Error');
    }
}

export async function openExport(exported: (SheetExport | SetExport), changeHash: boolean, viewOnly: boolean) {
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? GearPlanSheet.fromExport(exported) : GearPlanSheet.fromSetExport(exported);
    if (embed && !isFullSheet) {
        sheet.setViewOnly();
        openEmbed(sheet);
    }
    else {
        if (viewOnly) {
            sheet.setViewOnly();
        }
        // sheet.name = SHARED_SET_NAME;
        openSheet(sheet, false);
    }
}

export async function openSheet(planner: GearPlanSheet, changeHash: boolean = true) {
    setTitle('Loading Sheet');
    console.log('openSheet: ', planner.saveKey);
    document['planner'] = planner;
    if (changeHash) {
        setHash("sheet", planner.saveKey, "dont-copy-this-link", "use-the-export-button");
    }
    contentArea.replaceChildren(planner);
    const oldHash = getHash();
    const loadSheetPromise = planner.loadData().then(() => {
        // If the user has navigated away while the sheet was loading, do not display the sheet.
        if (arrayEq(getHash(), oldHash)) {
            contentArea.replaceChildren(planner);
            setTitle(planner.sheetName);
        }
    }, (reason) => {
        console.error(reason);
        contentArea.replaceChildren(document.createTextNode("Error loading sheet!"));
    });
    await loadSheetPromise;
}

function showSheetPickerMenu() {
    const holderDiv = quickElement('div', ['sheet-picker-holder'], [new SheetPickerTable()]);
    setMainContent(undefined, holderDiv);
    // contentArea.replaceChildren(new SheetPickerTable());
    // setTitle(undefined);
}

let isLightMode: boolean;

function setLightMode(lightMode: boolean | 'load') {
    const settingKey = 'light-mode';
    if (lightMode === 'load') {
        if (localStorage.getItem(settingKey) === 'true') {
            lightMode = true;
        }
        else {
            lightMode = false;
        }
    }
    else {
        localStorage.setItem(settingKey, String(lightMode));
    }
    const body = document.querySelector('body');
    const lightModeClass = 'light-mode';
    isLightMode = lightMode;
    if (lightMode) {
        body.classList.add(lightModeClass)
    }
    else {
        body.classList.remove(lightModeClass)
    }

}

function earlyUiSetup() {
    const devMenu = topMenuArea;
    document.getElementById('dev-menu-button')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (devMenu.style.display === 'none') {
            devMenu.style.display = '';
        }
        else {
            devMenu.style.display = 'none';
        }
    });
    setLightMode('load');
    document.getElementById('light-mode-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        setLightMode(!isLightMode);
    });
    const header = document.createElement("span")
    header.textContent = "Dev Menu";
    devMenu.appendChild(header);
    const nukeButton = document.createElement("button");
    nukeButton.addEventListener('click', (ev) => {
        if (confirm('This will DELETE ALL sheets, sets, and settings.')) {
            localStorage.clear();
            setHash();
            location.reload();
        }
    })
    nukeButton.textContent = "Nuke Local Storage";
    devMenu.appendChild(nukeButton);
}

// function iosPolyfill() {
//     const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
//     if (window['safari'] !== undefined) {
//         console.log('Doing iOS polyfill');
//         const scriptElement = document.createElement('script');
//         scriptElement.src = "//cdn.jsdelivr.net/npm/@ungap/custom-elements";
//         scriptElement.async = false;
//         customElements.
//         document.body.appendChild(scriptElement);
//     }
// }

document.addEventListener("DOMContentLoaded", () => {

    // iosPolyfill();
    earlyUiSetup();
    addEventListener("hashchange", processHash);
    initialLoad();
})

