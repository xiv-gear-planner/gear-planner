import {BaseModal} from "@xivgear/common-ui/components/modal";
import {
    clampValuesOrUndef, el,
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundIntOrUndefField, labeledCheckbox,
    labelFor,
    quickElement
} from "@xivgear/common-ui/components/util";
import {DISPLAY_SETTINGS} from "./display_settings";
import {BoolToggle} from "@xivgear/common-ui/components/bool_toggle";
import {recordEvent} from "../analytics/analytics";
import {ALL_LANGS, LangaugeDisplayName, Language} from "@xivgear/i18n/translation";
import {SETTINGS} from "./persistent_settings";


class SettingsModal extends BaseModal {

    private readonly refreshLabel = quickElement('span', [], ['Refresh to apply settings']);

    constructor() {
        super();
        this.headerText = 'Settings';
        this.setDisplayRefreshLabel(false);

        // const displaySettingsHeader = quickElement('h3', [], ['Theme']);
        // this.contentArea.append(displaySettingsHeader);
        const displaySettings = DISPLAY_SETTINGS;
        const lightModeCb = new FieldBoundCheckBox(displaySettings, 'lightMode');
        const lightModeToggle = new BoolToggle(lightModeCb, 'Light', 'Dark');
        lightModeCb.addListener((val: boolean) => recordEvent('lightModeToggle', {lightMode: val}));
        this.contentArea.append(lightModeToggle);

        const modernThemeCb = new FieldBoundCheckBox(displaySettings, 'modernTheme');
        const modernThemeToggle = new BoolToggle(modernThemeCb, 'Modern', 'Classic');
        modernThemeCb.addListener((val: boolean) => recordEvent('modernTheme', {modernTheme: val}));
        this.contentArea.append(modernThemeToggle);

        const langDropdown = new FieldBoundDataSelect<typeof displaySettings, Language | undefined>(displaySettings, 'languageOverride', (val: Language | undefined) => {
            if (val) {
                return LangaugeDisplayName[val];
            }
            else {
                return 'Auto';
            }
        }, [undefined, ...ALL_LANGS]);
        langDropdown.addListener((val: Language | undefined) => recordEvent('langChange', {lang: val}));
        langDropdown.addListener(() => this.setDisplayRefreshLabel(true));
        langDropdown.id = 'language-picker';
        const langLabel = labelFor("Game Items Language:", langDropdown);
        this.contentArea.append(langLabel);
        this.contentArea.append(langDropdown);
        this.contentArea.append(el('br'));

        const workersCount = new FieldBoundIntOrUndefField(SETTINGS, 'workersOverride', {
            postValidators: [clampValuesOrUndef(2, 1024)],
        });
        workersCount.style.width = '100%';
        workersCount.style.boxSizing = 'border-box';
        workersCount.placeholder = 'Leave blank to use default';
        const workersLabel = labelFor("Meld Solver Workers: ", workersCount);
        workersCount.addListener(() => this.setDisplayRefreshLabel(true));
        this.contentArea.append(workersLabel);
        this.contentArea.append(workersCount);
        this.contentArea.append(el('br'));

        const reverseSortCb = new FieldBoundCheckBox(displaySettings, 'reverseItemSort');
        const reverseSort = labeledCheckbox('Reverse Item Sort', reverseSortCb);
        reverseSortCb.addListener(() => this.setDisplayRefreshLabel(true));

        this.contentArea.append(reverseSort);
        this.contentArea.append(el('br'));

        this.contentArea.append(this.refreshLabel);

        this.addCloseButton();
    }

    setDisplayRefreshLabel(show: boolean): void {
        if (show) {
            this.refreshLabel.style.visibility = '';
        }
        else {
            this.refreshLabel.style.visibility = 'hidden';
        }
    }
}

export function showSettingsModal() {
    const dialog = document.createElement('settings-modal') as SettingsModal;
    dialog.attachAndShowExclusively();
    recordEvent('openSettingsModal');
}

customElements.define('settings-modal', SettingsModal);
