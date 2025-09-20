import {GearPlanSheetGui, GearSetEditor, GearSetViewer} from "./sheet";
import {quickElement} from "@xivgear/common-ui/components/util";

export class PopoutEditor extends HTMLElement {
    private readonly sheet: GearPlanSheetGui;
    private readonly index: number;
    private mainElement!: GearSetEditor | GearSetViewer;

    constructor(sheet: GearPlanSheetGui, index: number) {
        super();
        this.sheet = sheet;
        this.index = index;
        this.build();
    }

    private build() {
        const set = this.sheet.sets[this.index];
        const readonly = this.sheet.isViewOnly;
        this.mainElement = readonly ? new GearSetViewer(this.sheet, set) : new GearSetEditor(this.sheet, set);
        // TODO: toolbar
        // const toolbar = readonly ? mainElement.toolbar : new GearEditToolbar(sheet, )
        this.replaceChildren(quickElement('div', ['popup-main-area'], [this.mainElement]));
    }

    /**
     * Refresh the editor/viewer inside the popout to reflect updated settings.
     */
    public filterSettingsRefresh() {
        this.mainElement.setup();
    }

}

customElements.define('popout-editor', PopoutEditor);
