import {BaseModal} from "@xivgear/common-ui/components/modal";
import {FieldBoundCheckBox} from "@xivgear/common-ui/components/util";
import {DISPLAY_SETTINGS} from "./display_settings";
import {BoolToggle} from "@xivgear/common-ui/components/bool_toggle";
import {recordEvent} from "@xivgear/core/analytics/analytics";


class SettingsModal extends BaseModal {
    constructor() {
        super();
        this.headerText = 'Settings';
        // TODO: consider using slide toggles

        const settings = DISPLAY_SETTINGS;
        const lightModeCb = new FieldBoundCheckBox(settings, 'lightMode');
        const lightModeToggle = new BoolToggle(lightModeCb, 'Light', 'Dark');
        lightModeCb.addListener(val => recordEvent('lightModeToggle', {lightMode: val}));
        const modernThemeCb = new FieldBoundCheckBox(settings, 'modernTheme');
        const modernThemeToggle = new BoolToggle(modernThemeCb, 'Modern', 'Classic');
        modernThemeCb.addListener(val => recordEvent('modernTheme', {modernTheme: val}));

        this.contentArea.append(lightModeToggle);
        this.contentArea.append(modernThemeToggle);
        this.addCloseButton();
    }
}

export function showSettingsModal() {
    const dialog = new SettingsModal();
    dialog.attachAndShow();
    recordEvent('openSettingsModal');
}

customElements.define('settings-modal', SettingsModal);
