import {goHash, processNav, setHash} from "./nav_hash";
import {DISPLAY_SETTINGS} from "@xivgear/common-ui/settings/display_settings";
import {showSettingsModal} from "@xivgear/common-ui/settings/settings_modal";
import {splitPath} from "@xivgear/core/nav/common_nav";
import {applyCommonTopMenuFormatting} from "@xivgear/common-ui/components/top_menu";
import {arrayEq} from "@xivgear/util/array_utils";

const pageTitle = 'XivGear - FFXIV Gear Planner';

export async function initialLoad() {
    await processNav();
}

function getRequiredElementById(id: string): HTMLElement {
    const out = document.getElementById(id);
    if (out === null) {
        console.error(`Cannot find element ${id}`);
        throw new Error(`Cannot find element ${id}`);
    }
    return out;
}

export const contentArea = getRequiredElementById("content-area");
export const devMenuArea = getRequiredElementById("dev-menu-area");
export const topMenuArea = getRequiredElementById("main-menu-area");
export const welcomeArea = getRequiredElementById("welcome-message");

export function setMainContent(title: string, ...nodes: Parameters<ParentNode['replaceChildren']>) {
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
        applyCommonTopMenuFormatting(link);
        if (href?.startsWith('?page=')) {
            const expected = splitPath(href.slice(6));
            console.debug(`Expected: ${expected}, actual: ${hash}`);
            if (arrayEq(expected, hash)) {
                link.classList.add('current-page');
            }
            else {
                if (hash.length >= expected.length && arrayEq(hash.slice(0, expected.length), expected)) {
                    link.classList.add('current-page');
                }
                else {
                    link.classList.remove('current-page');
                }
            }
        }
    });
}

export function setTitle(titlePart: string | undefined) {
    if (titlePart === undefined) {
        document.title = pageTitle;
    }
    else {
        document.title = titlePart + ' - ' + pageTitle;
    }
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
    getRequiredElementById('settings-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        showSettingsModal();
    });
    getRequiredElementById('show-hide-menu-button').addEventListener('click', (ev) => {
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
