import {ILvlRangePicker} from "./items";
import {ItemDisplaySettings, MateriaAutoFillController} from "@xivgear/xivmath/geartypes";
import {MateriaPriorityPicker} from "./materia";
import {StatTierDisplay} from "./stat_tier_display";
import {CharacterGearSet} from "@xivgear/core/gear";
import {makeActionButton, redoIcon, undoIcon} from "@xivgear/common-ui/components/util";
import {recordEvent, recordSheetEvent} from "@xivgear/core/analytics/analytics";
import { GearPlanSheetGui } from "./sheet";

export class UndoArea extends HTMLDivElement {
    private _currentSet: CharacterGearSet;
    private undoButton: HTMLButtonElement;
    private redoButton: HTMLButtonElement;

    constructor() {
        super();
        this.classList.add('undo-controls');
        this.undoButton = makeActionButton([undoIcon()], () => {
            recordEvent("undo");
            this.currentSet?.undo();
        }, 'Undo');
        this.redoButton = makeActionButton([redoIcon()], () => {
            recordEvent("redo");
            this.currentSet?.redo();
        }, 'Redo');
        this.replaceChildren(this.undoButton, this.redoButton);
    }

    set currentSet(value: CharacterGearSet) {
        this._currentSet = value;
        this.refresh();
        // For the initial change to a set, we need to wait before refreshing this so that it shows the new state,
        // since the history state push is delayed.
        setTimeout(() => this.refresh(), 200);
    }

    get currentSet(): CharacterGearSet {
        return this._currentSet;
    }

    refresh() {
        this.undoButton.disabled = !this.currentSet.canUndo();
        this.redoButton.disabled = !this.currentSet.canRedo();
    }

}

export class GearEditToolbar extends HTMLDivElement {
    private readonly statTierDisplay: StatTierDisplay;
    private undoArea: UndoArea;

    constructor(sheet: GearPlanSheetGui,
                itemDisplaySettings: ItemDisplaySettings,
                displayUpdateCallback: () => void,
                matFillCtrl: MateriaAutoFillController,
    ) {
        super();
        this.classList.add('gear-set-editor-toolbar');

        // const leftDrag = quickElement('div', ['toolbar-float-left'], [document.createTextNode('≡')])
        // const rightDrag = quickElement('div', ['toolbar-float-right'], [document.createTextNode('≡')])
        // this.appendChild(leftDrag);
        // this.appendChild(rightDrag);

        this.undoArea = new UndoArea();
        this.appendChild(this.undoArea);

        const ilvlDiv = document.createElement('div');
        ilvlDiv.classList.add('ilvl-picker-area');
        const itemIlvlRange = new ILvlRangePicker(itemDisplaySettings, 'minILvl', 'maxILvl', 'Gear:');
        itemIlvlRange.addListener(displayUpdateCallback);
        itemIlvlRange.addListener((min, max) => {
            recordSheetEvent('itemIlvlRange', sheet, {
                min: min,
                max: max
            });
        });
        ilvlDiv.appendChild(itemIlvlRange);

        const foodIlvlRange = new ILvlRangePicker(itemDisplaySettings, 'minILvlFood', 'maxILvlFood', 'Food:');
        foodIlvlRange.addListener(displayUpdateCallback);
        foodIlvlRange.addListener((min, max) => {
            recordSheetEvent('foodIlvlRange', sheet, {
                min: min,
                max: max
            });
        });
        ilvlDiv.appendChild(foodIlvlRange);

        this.appendChild(ilvlDiv);

        const materiaPriority = new MateriaPriorityPicker(matFillCtrl, sheet);
        this.appendChild(materiaPriority);

        this.statTierDisplay = new StatTierDisplay(sheet);
        this.appendChild(this.statTierDisplay);
    }

    refresh(gearSet: CharacterGearSet) {
        this.undoArea.currentSet = gearSet;
        this.statTierDisplay.refresh(gearSet);
    }
}

customElements.define('gear-edit-toolbar', GearEditToolbar, {extends: 'div'});
customElements.define('gear-edit-toolbar-undo-area', UndoArea, {extends: 'div'});
