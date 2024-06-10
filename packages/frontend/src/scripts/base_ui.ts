import {arrayEq, getHash, goHash, isEmbed, processHashLegacy, processNav, setHash} from "./nav_hash";
import {NamedSection} from "./components/section";
import {NewSheetForm} from "./components/new_sheet_form";
import {ImportSheetArea} from "./components/import_sheet";
import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {openEmbed} from "./embed";
import {SETTINGS} from "./settings/persistent_settings";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {SheetPickerTable} from "./components/saved_sheet_picker";
import {DISPLAY_SETTINGS} from "./settings/display_settings";
import {showSettingsModal} from "./settings/settings_modal";
import {GearPlanSheetGui, GRAPHICAL_SHEET_PROVIDER} from "./components/sheet";
import {splitPath} from "@xivgear/core/nav/common_nav";

const pageTitle = 'XivGear - FFXIV Gear Planner';

export async function initialLoad() {
    if (location.hash) {
        await processHashLegacy();
    }
    else {
        await processNav();
    }
    handleWelcomeArea();
}

export const contentArea = document.getElementById("content-area");
// export const midBarArea = document.getElementById("mid-controls-area");
export const devMenuArea = document.getElementById("dev-menu-area");
export const topMenuArea = document.getElementById("main-menu-area");
// const editorArea = document.getElementById("editor-area");
export const welcomeArea = document.getElementById("welcome-message");
export const welcomeCloseButton = document.getElementById("welcome-close-button");

export function handleWelcomeArea() {
    if (getHash()?.length > 0) {
        // hideWelcomeArea();
    }
    else {
        if (SETTINGS.hideWelcomeMessage) {
            hideWelcomeArea();
        }
        else {
            welcomeCloseButton.addEventListener('click', () => {
                SETTINGS.hideWelcomeMessage = true;
                hideWelcomeArea();
            })
        }
    }
}

export function hideWelcomeArea() {
    welcomeArea.style.display = 'none';
}

export function setMainContent(title: string, ...nodes) {
    contentArea.replaceChildren(...nodes);
    setTitle(title);
}

export function initTopMenu() {
    topMenuArea.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href?.startsWith('?page=')) {
            link.addEventListener('click', e => {
                e.preventDefault();
                goHash(...splitPath(href.slice(6)));
            });
        }
    });
}

export function formatTopMenu(hash: string[]) {
    topMenuArea.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href?.startsWith('?page=')) {
            const expected = splitPath(href.slice(6));
            console.trace(`Expected: ${expected}, actual: ${hash}`);
            if (arrayEq(expected, hash)) {
                link.classList.add('current-page');
            }
            else {
                link.classList.remove('current-page');
            }
        }
    });
}

export function showLoadingScreen() {
    setMainContent('Loading...', new LoadingBlocker());
}

export function showNewSheetForm() {
    setHash('newsheet');
    const section = new NamedSection('New Gear Planning Sheet');
    const form = new NewSheetForm(openSheet);
    section.contentArea.replaceChildren(form);
    setMainContent('New Sheet', section);
    form.takeFocus();
}

export function showImportSheetForm() {
    setHash('importsheet');
    setMainContent('Import Sheet', new ImportSheetArea(async sheet => {
        setHash('imported');
        openSheet(sheet, false);
    }));
}

export function setTitle(titlePart: string | undefined) {
    if (titlePart === undefined) {
        document.title = pageTitle;
    }
    else {
        document.title = titlePart + ' - ' + pageTitle;
    }
}

export async function openSheetByKey(sheet: string) {
    // TODO: handle nonexistent sheet
    setTitle('Loading Sheet');
    console.log('openSheetByKey: ', sheet);
    const planner = GRAPHICAL_SHEET_PROVIDER.fromSaved(sheet);
    if (planner) {
        await openSheet(planner);
    }
    else {
        contentArea.replaceChildren(document.createTextNode("That sheet does not exist."));
        setTitle('Error');
    }
}

export async function openExport(exported: (SheetExport | SetExport), changeHash: boolean, viewOnly: boolean) {
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? GRAPHICAL_SHEET_PROVIDER.fromExport(exported) : GRAPHICAL_SHEET_PROVIDER.fromSetExport(exported);
    if (isEmbed() && !isFullSheet) {
        sheet.setViewOnly();
        openEmbed(sheet);
    }
    else {
        if (viewOnly || isEmbed()) {
            sheet.setViewOnly();
        }
        // sheet.name = SHARED_SET_NAME;
        openSheet(sheet, false);
    }
}

export function getHashForSaveKey(saveKey: string) {
    return ["sheet", saveKey, "dont-copy-this-link", "use-the-export-button"];
}

export async function openSheet(planner: GearPlanSheetGui, changeHash: boolean = true) {
    setTitle('Loading Sheet');
    console.log('openSheet: ', planner.saveKey);
    document['planner'] = planner;
    window['currentSheet'] = planner;
    if (changeHash) {
        setHash("sheet", planner.saveKey, "dont-copy-this-link", "use-the-export-button");
    }
    contentArea.replaceChildren(planner.topLevelElement);
    const oldHash = getHash();
    const loadSheetPromise = planner.load().then(() => {
        // If the user has navigated away while the sheet was loading, do not display the sheet.
        const newHash = getHash();
        if (arrayEq(newHash, oldHash)) {
            contentArea.replaceChildren(planner.topLevelElement);
            setTitle(planner.sheetName);
        }
        else {
            console.log("Canceled showing sheet due to hash change", oldHash, newHash);
        }
    }, (reason) => {
        console.error(reason);
        contentArea.replaceChildren(document.createTextNode("Error loading sheet!"));
    });
    await loadSheetPromise;
}

export function showSheetPickerMenu() {
    const picker = new SheetPickerTable();
    const section = new NamedSection('My Sheets', false);
    section.classList.add('my-sheets-section');
    section.contentArea.replaceChildren(picker);
    // const holderDiv = quickElement('div', ['sheet-picker-holder'], [new SheetPickerTable()]);
    setMainContent(undefined, section);
    // contentArea.replaceChildren(new SheetPickerTable());
    // setTitle(undefined);
}


export function earlyUiSetup() {
    const devMenu = devMenuArea;
    document.getElementById('dev-menu-button')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (devMenu.style.display === 'none') {
            devMenu.style.display = '';
        }
        else {
            devMenu.style.display = 'none';
        }
    });
    DISPLAY_SETTINGS.loadSettings();
    document.getElementById('settings-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        showSettingsModal();
    });
    document.getElementById('show-hide-menu-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        topMenuArea.style.display = topMenuArea.style.display === 'none' ? '' : 'none';
    });
    const header = document.createElement("span");
    header.textContent = "Dev Menu";
    devMenu.appendChild(header);
    const nukeButton = document.createElement("button");
    nukeButton.addEventListener('click', (ev) => {
        if (confirm('This will DELETE ALL sheets, sets, and settings.')) {
            localStorage.clear();
            setHash();
            location.reload();
        }
    });
    nukeButton.textContent = "Nuke Local Storage";
    devMenu.appendChild(nukeButton);
}
