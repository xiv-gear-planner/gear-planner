import {goPath, processNav} from "./nav_hash";
import {DISPLAY_SETTINGS} from "@xivgear/common-ui/settings/display_settings";
import {showSettingsModal} from "@xivgear/common-ui/settings/settings_modal";
import {splitUrlPath} from "@xivgear/core/nav/common_nav";
import {applyCommonSideMenuFormatting} from "@xivgear/common-ui/components/menu_items";
import {arrayEq} from "@xivgear/util/array_utils";
import {setupSideNavigation} from "@xivgear/common-ui/components/side_navigation";

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

const contentArea = getRequiredElementById("content-area");
const topMenuArea = getRequiredElementById("main-menu-area");
export const welcomeArea = getRequiredElementById("welcome-message");

export function setMainContent(title: string, ...nodes: Parameters<ParentNode['replaceChildren']>) {
    contentArea.replaceChildren(...nodes);
    setTitle(title);
}

export function initSideMenu() {
    topMenuArea.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        if (href?.startsWith('/')) {
            link.addEventListener('click', e => {
                e.preventDefault();
                goPath(...splitUrlPath(href));
            });
        }
    });
}

export function formatSideMenu(hash: string[]) {
    topMenuArea.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href');
        applyCommonSideMenuFormatting(link);
        if (href?.startsWith('/')) {
            const expected = splitUrlPath(href);
            console.debug(`Expected: ${expected}, actual: ${hash}`);
            // We want the math page to still be selected when you select a subpage of it.
            const isSelected = arrayEq(expected, hash) || href === '/math' && hash[0] === 'math';
            link.classList.toggle('current-page', isSelected);
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
    DISPLAY_SETTINGS.loadSettings();
    setupSideNavigation();
    getRequiredElementById('settings-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        showSettingsModal();
    });
}
