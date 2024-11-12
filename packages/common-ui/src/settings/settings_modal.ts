import {BaseModal} from "@xivgear/common-ui/components/modal";
import {FieldBoundCheckBox, FieldBoundDataSelect, labelFor} from "@xivgear/common-ui/components/util";
import {DISPLAY_SETTINGS} from "./display_settings";
import {BoolToggle} from "@xivgear/common-ui/components/bool_toggle";
import {recordEvent} from "@xivgear/core/analytics/analytics";
import {ALL_LANGS, LangaugeDisplayName, Language} from "@xivgear/core/i18n/translation";


class SettingsModal extends BaseModal {
    constructor() {
        super();
        this.headerText = 'Settings';

        const settings = DISPLAY_SETTINGS;
        const lightModeCb = new FieldBoundCheckBox(settings, 'lightMode');
        const lightModeToggle = new BoolToggle(lightModeCb, 'Light', 'Dark');
        lightModeCb.addListener(val => recordEvent('lightModeToggle', {lightMode: val}));
        this.contentArea.append(lightModeToggle);

        const modernThemeCb = new FieldBoundCheckBox(settings, 'modernTheme');
        const modernThemeToggle = new BoolToggle(modernThemeCb, 'Modern', 'Classic');
        modernThemeCb.addListener(val => recordEvent('modernTheme', {modernTheme: val}));
        this.contentArea.append(modernThemeToggle);

        const langDropdown = new FieldBoundDataSelect<typeof settings, Language | undefined>(settings, 'languageOverride', val => {
            if (val) {
                return LangaugeDisplayName[val];
            }
            else {
                return 'Auto';
            }
        }, [undefined, ...ALL_LANGS]);
        langDropdown.addListener(val => recordEvent('langChange', {lang: val}));
        langDropdown.id = 'language-picker';
        const langLabel = labelFor("Game Items Language:", langDropdown);
        this.contentArea.append(langLabel);
        this.contentArea.append(document.createElement('br'));
        this.contentArea.append(langDropdown);
        this.contentArea.append(document.createElement('br'));
        this.contentArea.append('Refresh after changing language.');

        this.addCloseButton();
    }
}

export function showSettingsModal() {
    const dialog = new SettingsModal();
    dialog.attachAndShow();
    recordEvent('openSettingsModal');
}

customElements.define('settings-modal', SettingsModal);
