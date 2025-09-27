import {GearPlanSheetGui, GearSetEditor, GearSetViewer} from "./sheet";
import {quickElement} from "@xivgear/common-ui/components/util";
import {PopoutGearEditToolbar} from "./gear_edit_toolbar";
import {PopoutMainElement} from "../popout";
import {CharacterGearSet} from "@xivgear/core/gear";

export class PopoutEditor extends HTMLElement implements PopoutMainElement {
    private readonly sheet: GearPlanSheetGui;
    private readonly index: number;
    private mainElement!: GearSetEditor | GearSetViewer;
    private toolbar: PopoutGearEditToolbar | null = null;
    readonly set: CharacterGearSet;

    constructor(sheet: GearPlanSheetGui, index: number) {
        super();
        this.sheet = sheet;
        this.index = index;
        this.set = sheet.sets[index];
        this.build();
    }

    private build() {
        const set = this.set;
        const readonly = this.sheet.isViewOnly;
        this.mainElement = readonly ? new GearSetViewer(this.sheet, set) : new GearSetEditor(this.sheet, set);
        // TODO: toolbar
        // const toolbar = readonly ? mainElement.toolbar : new GearEditToolbar(sheet, )
        if (readonly) {
            // TBD as to what view-only will look like for popouts
            this.replaceChildren(
                quickElement('div', ['popup-main-area'], [this.mainElement])
            );
        }
        else {
            this.toolbar = new PopoutGearEditToolbar(this.sheet, set, this.sheet.itemDisplaySettings, () => this.sheet.gearDisplaySettingsUpdateNow(), this.sheet.makeMateriaAutoFillController(() => set));
            set.addListener(() => this.toolbar.refresh(set));
            this.toolbar.refresh(set);
            this.replaceChildren(
                quickElement('div', ['popup-toolbar-area', 'gear-sheet-midbar-area'], [this.toolbar]),
                quickElement('div', ['popup-main-area'], [this.mainElement])
            );
        }
    }

    /**
     * Refresh the editor/viewer inside the popout to reflect updated settings.
     */
    refreshContent() {
        this.mainElement.setup();
    }

    refreshToolbar() {
        this.toolbar?.refresh(this.set);
    }

}

customElements.define('popout-editor', PopoutEditor);
