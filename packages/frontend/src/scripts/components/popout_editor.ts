import {GearPlanSheetGui, GearSetEditor, GearSetViewer} from "./sheet";
import {quickElement} from "@xivgear/common-ui/components/util";

export class PopoutEditor extends HTMLElement {
    constructor(sheet: GearPlanSheetGui, index: number) {
        super();
        const set = sheet.sets[index];
        const readonly = sheet.isViewOnly;
        const mainElement = readonly ? new GearSetViewer(sheet, set) : new GearSetEditor(sheet, set);
        // TODO: toolbar
        // const toolbar = readonly ? mainElement.toolbar : new GearEditToolbar(sheet, )
        this.replaceChildren(quickElement('div', ['popup-main-area'], [mainElement]));
    }
}

customElements.define('popout-editor', PopoutEditor);
