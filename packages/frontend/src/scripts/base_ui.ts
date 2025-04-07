import {getCurrentState, getHash, goPath, isEmbed, processHashLegacy, processNav, setPath} from "./nav_hash";
import {NamedSection} from "./components/section";
import {NewSheetForm} from "./components/new_sheet_form";
import {ImportSheetArea} from "./components/import_sheet";
import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {getEmbedDiv, openEmbed} from "./embed";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {SheetPickerTable} from "./components/saved_sheet_picker";
import {GearPlanSheetGui, GRAPHICAL_SHEET_PROVIDER} from "./components/sheet";
import {makeUrl, NavState, splitPath} from "@xivgear/core/nav/common_nav";
import {applyCommonTopMenuFormatting} from "@xivgear/common-ui/components/top_menu";
import {WORKER_POOL} from "./workers/worker_pool";
import {showSettingsModal} from "@xivgear/common-ui/settings/settings_modal";
import {SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";
import {DISPLAY_SETTINGS} from "@xivgear/common-ui/settings/display_settings";
import {arrayEq} from "@xivgear/util/array_utils";
import {extractSingleSet} from "@xivgear/core/util/sheet_utils";
import {CharacterGearSet} from "@xivgear/core/gear";
import {recordSheetEvent} from "./analytics/analytics";
import {recordError} from "@xivgear/common-ui/analytics/analytics";
import {isInIframe} from "@xivgear/common-ui/util/detect_iframe";

declare global {
    interface Document {
        planner?: GearPlanSheetGui;
    }

    // noinspection JSUnusedGlobalSymbols
    interface Window {
        currentSheet?: GearPlanSheetGui;
        currentGearSet?: CharacterGearSet;
    }
}
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
            });
        }
    }
}

export function hideWelcomeArea() {
    welcomeArea.style.display = 'none';
}

export function setMainContent(title: string, ...nodes: Parameters<ParentNode['replaceChildren']>) {
    contentArea.replaceChildren(...nodes);
    setTitle(title);
}

export function showFatalError(errorText: string) {
    recordError("showFatalError", errorText);
    const errMsg = document.createElement('h1');
    errMsg.textContent = errorText;
    const embedDiv = getEmbedDiv();
    if (embedDiv !== undefined) {
        setTitle("Error");
        embedDiv.replaceChildren(errMsg);
    }
    else {
        setMainContent("Error", errMsg);
    }
}

export function initTopMenu() {
    topMenuArea.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href?.startsWith('?page=')) {
            link.addEventListener('click', e => {
                e.preventDefault();
                goPath(...splitPath(href.slice(6)));
            });
        }
    });
}

export function formatTopMenu(nav: NavState) {
    const hash = nav.path;
    topMenuArea.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        applyCommonTopMenuFormatting(link);
        if (href?.startsWith('?page=')) {
            const expected = splitPath(href.slice(6));
            console.debug(`Expected: ${expected}, actual: ${hash}`);
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
    setPath('newsheet');
    const section = new NamedSection('New Gear Planning Sheet');
    const form = new NewSheetForm(openSheet);
    section.contentArea.replaceChildren(form);
    setMainContent('New Sheet', section);
    form.takeFocus();
}

export function showImportSheetForm() {
    setPath('importsheet');
    setMainContent('Import Sheet', new ImportSheetArea(async sheet => {
        setPath('imported');
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
    setTitle('Loading Sheet');
    console.log('openSheetByKey: ', sheet);
    const planner = GRAPHICAL_SHEET_PROVIDER.fromSaved(sheet);
    if (planner) {
        recordSheetEvent("openSheetByKey", planner);
        await openSheet(planner);
    }
    else {
        contentArea.replaceChildren(document.createTextNode("That sheet does not exist."));
        setTitle('Error');
    }
}

type OriginalSheetBacklinkData = {
    sheetName: string,
    sheetUrl: URL,
}

export async function openExport(exportedPre: SheetExport | SetExport, viewOnly: boolean, onlySetIndex: number | undefined, defaultSelectionIndex: number | undefined) {
    const exportedInitial = exportedPre;
    const initiallyFullSheet = 'sets' in exportedInitial;
    let backlink: OriginalSheetBacklinkData = null;
    if (onlySetIndex !== undefined) {
        if (!initiallyFullSheet) {
            console.warn("onlySetIndex does not make sense when isFullSheet is false");
        }
        else {
            const navState = getCurrentState();
            backlink = {
                sheetName: exportedInitial.name,
                sheetUrl: makeUrl(new NavState(navState.path, undefined, navState.onlySetIndex)),
            };
            exportedPre = extractSingleSet(exportedInitial, onlySetIndex);
            if (exportedPre === undefined) {
                showFatalError(`Error: Set index ${onlySetIndex} is not valid.`);
                throw new Error(`Error: Set index ${onlySetIndex} is not valid.`);
            }
        }
    }
    const exported = exportedPre;
    const isFullSheet = 'sets' in exported;
    const sheet = isFullSheet ? GRAPHICAL_SHEET_PROVIDER.fromExport(exported) : GRAPHICAL_SHEET_PROVIDER.fromSetExport(exported);
    if (defaultSelectionIndex !== undefined) {
        sheet.defaultSelectionIndex = defaultSelectionIndex;
    }
    const embed = isEmbed();
    if (isInIframe()) {
        const extraData: {
            topLocation?: string,
            referrer?: string,
        } = {};
        try {
            extraData['topLocation'] = window.top.location.hostname;
        }
        catch (e) {
            // Ignored
        }
        if (document.referrer) {
            extraData['referrer'] = document.referrer;
        }
        recordSheetEvent('iframe', sheet, extraData);
        if (!isEmbed()) {
            recordSheetEvent('nonEmbeddedIframe', sheet, extraData);
        }
    }
    const analyticsData = {
        'isEmbed': embed,
        'viewOnly': viewOnly,
        'nav': getHash(),
    };
    recordSheetEvent('openExport', sheet, analyticsData);
    if (embed) {
        if (isFullSheet) {
            showFatalError("Embedding is only supported for a single set, not a full sheet. Consider embedding sets individually and/or linking to the full sheet rather than embedding it.");
        }
        else {
            sheet.setViewOnly();
            openEmbed(sheet);
        }
    }
    else {
        if (viewOnly) {
            if (backlink !== null) {
                sheet.configureBacklinkArea(backlink.sheetName, backlink.sheetUrl);
            }
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
    document.planner = planner;
    window.currentSheet = planner;
    if (changeHash) {
        setPath("sheet", planner.saveKey, "dont-copy-this-link", "use-the-export-button");
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
        recordError("load", reason);
        showFatalError("Error Loading Sheet!");
    });
    await loadSheetPromise;
    // TODO: does this visibly slow down sheet access?
    await WORKER_POOL.setSheet(planner);
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
            setPath();
            location.reload();
        }
    });
    nukeButton.textContent = "Nuke Local Storage";
    devMenu.appendChild(nukeButton);
}
