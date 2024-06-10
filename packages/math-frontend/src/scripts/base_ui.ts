import {arrayEq, getHash, goHash, processNav, setHash} from "./nav_hash";
import {SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";
import {DISPLAY_SETTINGS} from "@xivgear/common-ui/settings/display_settings";
import {showSettingsModal} from "@xivgear/common-ui/settings/settings_modal";
import {splitPath} from "@xivgear/core/nav/common_nav";
import { LoadingBlocker } from "@xivgear/common-ui/components/loader";

const pageTitle = 'XivGear - FFXIV Gear Planner';

export async function initialLoad() {
    await processNav();
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
                if (hash.length >= expected.length && arrayEq(hash.slice(0, expected.length), expected)) {
                    link.classList.add('current-page');
                }
                else{
                    link.classList.remove('current-page');
                }
            }
        }
    });
}

export function showLoadingScreen() {
    setMainContent('Loading...', new LoadingBlocker());
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
