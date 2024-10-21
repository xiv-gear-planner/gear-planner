import {ILvlRangePicker} from "./items";
import {ItemDisplaySettings, MateriaAutoFillController} from "@xivgear/xivmath/geartypes";
import {MateriaPriorityPicker} from "./materia";
import {StatTierDisplay} from "./stat_tier_display";
import {CharacterGearSet} from "@xivgear/core/gear";
import {makeActionButton, redoIcon, undoIcon} from "@xivgear/common-ui/components/util";
import {recordEvent, recordSheetEvent} from "@xivgear/core/analytics/analytics";
import {GearPlanSheetGui} from "./sheet";

function makeIlvlArea(
    sheet: GearPlanSheetGui,
    itemDisplaySettings: ItemDisplaySettings,
    displayUpdateCallback: () => void
) {
    const ilvlDiv = document.createElement('div');
    ilvlDiv.classList.add('ilvl-picker-area');
    const itemIlvlRange = new ILvlRangePicker(itemDisplaySettings, 'minILvl', 'maxILvl', 'Gear:');
    itemIlvlRange.addListener(displayUpdateCallback);
    itemIlvlRange.addListener((min, max) => {
        recordSheetEvent('itemIlvlRange', sheet, {
            min: min,
            max: max,
        });
    });
    ilvlDiv.appendChild(itemIlvlRange);

    const foodIlvlRange = new ILvlRangePicker(itemDisplaySettings, 'minILvlFood', 'maxILvlFood', 'Food:');
    foodIlvlRange.addListener(displayUpdateCallback);
    foodIlvlRange.addListener((min, max) => {
        recordSheetEvent('foodIlvlRange', sheet, {
            min: min,
            max: max,
        });
    });
    ilvlDiv.appendChild(foodIlvlRange);
    return ilvlDiv;
}

let currentToolbarPopout: HTMLElement | null = null;

document.addEventListener('resize', () => {
    if (currentToolbarPopout !== null) {
        // TODO
    }
});

export class ToolbarButtonsArea extends HTMLDivElement {
    private _currentSet: CharacterGearSet;
    private undoButton: HTMLButtonElement;
    private redoButton: HTMLButtonElement;
    private panelButtons: HTMLButtonElement[] = [];
    private popoutArea: HTMLDivElement;

    constructor() {
        super();
        this.classList.add('toolbar-buttons-area');
        this.undoButton = makeActionButton([undoIcon()], () => {
            recordEvent("undo");
            this.currentSet?.undo();
        }, 'Undo');
        this.undoButton.classList.add('big-text-btn');
        this.redoButton = makeActionButton([redoIcon()], () => {
            recordEvent("redo");
            this.currentSet?.redo();
        }, 'Redo');
        this.redoButton.classList.add('big-text-btn');
        this.popoutArea = document.createElement('div');
        this.popoutArea.classList.add('popout-area');
        // Don't allow clicking on the actual popout to be treated as clicking on the button
        // TODO: make sure this is happening for all events
        const evStop = (ev: MouseEvent) => {
            ev.stopPropagation();
            // ev.preventDefault();
        };
        // TODO: this logic still isn't working
        // It stops unintentionally closing it, but does not stop the :active state
        this.popoutArea.addEventListener('click', evStop, {
            // capture: true
        });
        this.popoutArea.addEventListener('mousedown', evStop);
        this.popoutArea.addEventListener('mouseup', evStop);
        this.popoutArea.addEventListener('pointerdown', evStop);
        this.popoutArea.addEventListener('pointerup', evStop);
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

    addPanelButton(label: (string | Node)[], popoutElement: HTMLElement) {
        const outer = this;
        const button = makeActionButton(label, (ev) => {
            outer.setActivePopout(button, popoutElement);
        });
        button.addEventListener('pointerdown', ev => {
            console.log(ev);
        });
        button.classList.add('popout-button');
        this.appendChild(button);
        this.panelButtons.push(button);
    }

    private setActivePopout(button: HTMLButtonElement, popoutElement: HTMLElement) {
        const attr = 'popout-active';
        // Same button was already active - click it again to hide it
        if (button.getAttribute(attr)) {
            button.removeAttribute(attr);
            this.setActivePopoutElement(undefined);
        }
        else { // New button pressed - show popout
            button.setAttribute(attr, 'true');
            this.panelButtons.forEach(btn => {
                if (btn !== button) {
                    btn.removeAttribute(attr);
                }
            });
            this.setActivePopoutElement(popoutElement);
            button.appendChild(this.popoutArea);
        }
    }

    private setActivePopoutElement(popoutElement: HTMLElement | undefined) {
        if (popoutElement !== undefined) {
            this.popoutArea.replaceChildren(popoutElement);
            this.popoutArea.style.display = '';
            currentToolbarPopout = popoutElement;
        }
        else {
            this.popoutArea.replaceChildren();
            this.popoutArea.style.display = 'none';
            currentToolbarPopout = null;
        }
    }
}

export class GearEditToolbar extends HTMLDivElement {
    private readonly statTierDisplay: StatTierDisplay;
    private buttonsArea: ToolbarButtonsArea;

    constructor(sheet: GearPlanSheetGui,
        itemDisplaySettings: ItemDisplaySettings,
        displayUpdateCallback: () => void,
        matFillCtrl: MateriaAutoFillController
    ) {
        super();
        this.classList.add('gear-set-editor-toolbar');

        // const leftDrag = quickElement('div', ['toolbar-float-left'], [document.createTextNode('≡')])
        // const rightDrag = quickElement('div', ['toolbar-float-right'], [document.createTextNode('≡')])
        // this.appendChild(leftDrag);
        // this.appendChild(rightDrag);

        this.buttonsArea = new ToolbarButtonsArea();

        const ilvlDiv = makeIlvlArea(sheet, itemDisplaySettings, displayUpdateCallback);
        this.buttonsArea.addPanelButton(["Gear", document.createElement('br'), "Filters"], ilvlDiv);

        this.appendChild(this.buttonsArea);

        const materiaPriority = new MateriaPriorityPicker(matFillCtrl, sheet);

        this.buttonsArea.addPanelButton(["Materia", document.createElement('br'), "Fill/Solve"], materiaPriority);

        this.statTierDisplay = new StatTierDisplay(sheet);
        this.appendChild(this.statTierDisplay);
    }

    refresh(gearSet: CharacterGearSet) {
        this.buttonsArea.currentSet = gearSet;
        this.statTierDisplay.refresh(gearSet);
    }
}

customElements.define('gear-edit-toolbar', GearEditToolbar, {extends: 'div',});
customElements.define('gear-edit-toolbar-buttons-area', ToolbarButtonsArea, {extends: 'div',});
