import {DISPLAY_SETTINGS} from "../settings/display_settings";
import type {SideMenuMode} from "../settings/persistent_settings";

const SIDE_MENU_MODES: readonly SideMenuMode[] = ['hidden', 'auto', 'sticky'];
// Keep this breakpoint in the menu controller: narrow expansion is temporary UI state, not a display setting.
const NARROW_DISPLAY_QUERY = '(max-width: 674px)';

export function getRequiredElements(): {
    body: HTMLBodyElement;
    menu: HTMLElement;
    button: HTMLButtonElement
} {
    const body = document.querySelector('body');
    if (body === null) {
        throw new Error('Cannot set up side navigation because body element is missing');
    }
    const menu = document.getElementById('main-menu-area');
    const button = document.querySelector('button#show-hide-menu-button') as HTMLButtonElement;
    if (menu === null) {
        throw new Error('Cannot set up side navigation because menu button is missing');
    }
    else if (button === null) {
        throw new Error('Cannot set up side navigation because toggle button is missing');
    }
    return {body, menu, button};
}

export function setupSideNavigation() {
    const {body, menu, button} = getRequiredElements();
    const toggleArea = button.parentElement;
    const narrowDisplay = window.matchMedia(NARROW_DISPLAY_QUERY);
    button.type = 'button';
    button.ariaLabel = 'Menu';
    button.title = 'Menu';
    menu.role = 'navigation';
    menu.ariaLabel = 'Main navigation';
    const helpLink = document.getElementById('help-button');
    if (helpLink) {
        helpLink.ariaLabel = 'Open help documentation';
        helpLink.title = 'Open help documentation';
    }

    function updateButton(): void {
        const mode = DISPLAY_SETTINGS.sideMenuMode;
        // On narrow screens the persisted wide mode is ignored; only the temporary drawer class controls expansion.
        const narrowExpanded = narrowDisplay.matches && body.classList.contains('side-menu-narrow-expanded');
        const expanded = narrowExpanded || (!narrowDisplay.matches && (mode === 'sticky' || (mode === 'auto' && document.body.classList.contains('side-menu-auto-expanded'))));
        button.ariaExpanded = String(expanded);
    }

    function applyClasses() {
        // Reapply the wide preference on resize or setting changes, but always start narrow screens closed.
        body.classList.remove('side-menu-mode-hidden', 'side-menu-mode-auto', 'side-menu-mode-sticky');
        const mode = narrowDisplay.matches ? 'hidden' : DISPLAY_SETTINGS.sideMenuMode;
        body.classList.add(`side-menu-mode-${mode}`);
        // A breakpoint or mode change closes any transient hover expansion or narrow drawer.
        body.classList.remove('side-menu-auto-expanded', 'side-menu-auto-suppressed', 'side-menu-narrow-expanded');
        updateButton();
    }

    button.addEventListener('click', event => {
        event.preventDefault();
        if (narrowDisplay.matches) {
            // Narrow mode only toggles a temporary drawer; it never changes the persisted tri-state setting.
            body.classList.toggle('side-menu-narrow-expanded');
            updateButton();
            return;
        }
        // Wide mode cycles Hidden -> Auto -> Sticky and persists through DisplaySettings.
        const currentMode = DISPLAY_SETTINGS.sideMenuMode;
        const currentIndex = SIDE_MENU_MODES.indexOf(currentMode);
        const nextMode = SIDE_MENU_MODES[(currentIndex + 1) % SIDE_MENU_MODES.length];
        DISPLAY_SETTINGS.sideMenuMode = nextMode;
        if (currentMode === 'hidden' && nextMode === 'auto') {
            // The toggle click leaves the pointer inside the menu area, so start Auto expanded immediately.
            body.classList.add('side-menu-auto-expanded');
        }
        updateButton();
    });
    window.addEventListener('side-menu-mode-change', applyClasses);
    narrowDisplay.addEventListener('change', applyClasses);

    function expandOnHover(event: PointerEvent) {
        // Auto mode expands on mouse hover; touch and narrow screens use the explicit menu button instead.
        if (!narrowDisplay.matches && event.pointerType === 'mouse' && DISPLAY_SETTINGS.sideMenuMode === 'auto') {
            body.classList.remove('side-menu-auto-suppressed');
            body.classList.add('side-menu-auto-expanded');
            updateButton();
        }
    }

    menu.addEventListener('pointerenter', expandOnHover);
    toggleArea?.addEventListener('pointerenter', expandOnHover);

    function collapseOnLeave(event: PointerEvent) {
        const nextTarget = event.relatedTarget;
        // Treat the toggle and menu as one hover area so moving between them does not collapse the menu.
        if (nextTarget instanceof Node && (menu.contains(nextTarget) || toggleArea?.contains(nextTarget))) {
            return;
        }
        body.classList.remove('side-menu-auto-expanded', 'side-menu-auto-suppressed');
        updateButton();
    }

    menu.addEventListener('pointerleave', collapseOnLeave);
    toggleArea?.addEventListener('pointerleave', collapseOnLeave);

    menu.addEventListener('click', event => {
        const target = event.target;
        if (target instanceof Element && target.closest('a, button, .extra-information-link')) {
            if (narrowDisplay.matches && body.classList.contains('side-menu-narrow-expanded')) {
                // Selecting a narrow-screen item closes the temporary drawer without persisting that state.
                body.classList.remove('side-menu-narrow-expanded');
                updateButton();
            }
            else if (!narrowDisplay.matches && DISPLAY_SETTINGS.sideMenuMode === 'auto') {
                // Keep Auto expanded until the pointer leaves, preventing immediate re-expansion after selection.
                body.classList.remove('side-menu-auto-expanded');
                body.classList.add('side-menu-auto-suppressed');
                updateButton();
            }
        }
    });

    document.addEventListener('click', event => {
        if (!narrowDisplay.matches || !body.classList.contains('side-menu-narrow-expanded')) {
            return;
        }
        const target = event.target;
        if (target instanceof Node && !menu.contains(target) && !toggleArea?.contains(target)) {
            // Clicking outside the temporary narrow drawer closes it without changing the saved wide mode.
            body.classList.remove('side-menu-narrow-expanded');
            updateButton();
        }
    });

    applyClasses();
}
