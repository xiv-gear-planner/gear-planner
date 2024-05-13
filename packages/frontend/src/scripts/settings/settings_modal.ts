import {BaseModal} from "../components/modal";
import {FieldBoundCheckBox, labeledCheckbox} from "../components/util";
import {DISPLAY_SETTINGS} from "./display_settings";
import {BoolToggle} from "../components/bool_toggle";


class SettingsModal extends BaseModal {
    constructor() {
        super();
        this.headerText = 'Settings';
        // TODO: consider using slide toggles

        const settings = DISPLAY_SETTINGS;
        const lightModeToggle = new BoolToggle(new FieldBoundCheckBox(settings, 'lightMode'), 'Light', 'Dark');
        const modernThemeToggle = new BoolToggle(new FieldBoundCheckBox(settings, 'modernTheme'), 'Modern', 'Classic');
        // const lightModeToggle = labeledCheckbox('Light Mode', new FieldBoundCheckBox(settings, 'lightMode'));
        // const modernThemeToggle = labeledCheckbox('Modern Theme', new FieldBoundCheckBox(settings, 'modernTheme'));

        this.contentArea.append(lightModeToggle);
        this.contentArea.append(modernThemeToggle);
        this.addCloseButton();
    }
}

export function showSettingsModal() {
    const dialog = new SettingsModal();
    dialog.attachAndShow();
}

customElements.define('settings-modal', SettingsModal);