import {CharacterGearSet} from "@xivgear/core/gear";
import {
    EquipmentSet,
    EquippedItem,
    EquipSlots,
    Materia,
    MATERIA_FILL_MODES,
    MateriaAutoFillController,
    MateriaFillMode,
    MeldableMateriaSlot,
    RawStatKey
} from "@xivgear/xivmath/geartypes";
import {MateriaSubstat, MAX_GCD, STAT_ABBREVIATIONS, STAT_FULL_NAMES} from "@xivgear/xivmath/xivconstants";
import {
    FieldBoundDataSelect,
    FieldBoundFloatField,
    labelFor,
    makeActionButton,
    makeTrashIcon,
    quickElement
} from "@xivgear/common-ui/components/util";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {GearPlanSheetGui} from "./sheet";
import {recordCurrentSheetEvent} from "../analytics/analytics";
import {MODAL_CONTROL} from "@xivgear/common-ui/modalcontrol";

/**
 * Component for managing all materia slots on an item
 */
export class AllSlotMateriaManager extends HTMLElement {
    private _children: SlotMateriaManager[] = [];

    constructor(private sheet: GearPlanSheet,
                private gearSet: CharacterGearSet,
                private slotName: keyof EquipmentSet,
                private readonly editable: boolean,
                private extraCallback: () => void = () => {
                }) {
        super();
        this.refresh();
        this.classList.add("all-slots-materia-manager");
        this.updateDisplay();
    }

    notifyChange() {
        this.gearSet.forceRecalc();
        this.extraCallback();
        this.updateDisplay();
    }

    updateDisplay() {
        const children = [...this._children];
        if (children.length === 0) {
            return;
        }
        const materiaPartial: Materia[] = [];
        for (let i = 0; i < children.length; i++) {
            const slot = children[i];
            const materia = slot.materiaSlot.equippedMateria;
            if (materia) {
                materiaPartial.push(materia);
                const statDetail = this.gearSet.getStatDetail(this.slotName, materia.primaryStat, materiaPartial);
                if (statDetail instanceof Object) {
                    slot.overcap = statDetail.overcapAmount;
                }
                else {
                    slot.overcap = 0;
                }
            }
            else {
                slot.overcap = 0;
            }
        }
    }

    refresh() {
        const equipSlot: EquippedItem | null | undefined = this.gearSet.equipment[this.slotName];
        if (equipSlot) {
            if (equipSlot.melds.length === 0) {
                this.classList.remove("materia-slot-no-equip");
                this.classList.add("materia-slot-no-slots");
                this.classList.remove("materia-manager-equipped");
                const textSpan = document.createElement("span");
                if (equipSlot.gearItem.isCustomRelic) {
                    textSpan.textContent = "Click into cells to edit relic stats";
                }
                else if (equipSlot.gearItem.isSyncedDown) {
                    textSpan.textContent = "Melds unavailable due to ilvl sync";
                }
                else {
                    textSpan.textContent = "No materia slots on this item";
                }
                this.replaceChildren(textSpan);
                this._children = [];
            }
            else {
                this._children = equipSlot.melds.map(meld => new SlotMateriaManager(this.sheet, meld, () => this.notifyChange(), this.editable));
                this.replaceChildren(...this._children);
                this.classList.remove("materia-slot-no-equip");
                this.classList.remove("materia-slot-no-slots");
                this.classList.add("materia-manager-equipped");
            }
        }
        else {
            const textSpan = document.createElement("span");
            textSpan.textContent = "No item selected";
            this.replaceChildren(textSpan);
            this.classList.add("materia-slot-no-equip");
            this.classList.remove("materia-slot-no-slots");
            this.classList.remove("materia-manager-equipped");
            this._children = [];
        }
    }

    refreshFull(): void {
        this.refresh();
        this.updateDisplay();
    }
}

/**
 * UI for picking a single materia slot
 */
export class SlotMateriaManager extends HTMLElement {

    private popup: SlotMateriaManagerPopup | undefined;
    private readonly text: HTMLSpanElement;
    private readonly image: HTMLImageElement;
    private _overcap: number;

    constructor(private sheet: GearPlanSheet, public materiaSlot: MeldableMateriaSlot, private callback: () => void, editable: boolean) {
        super();
        this.classList.add("slot-materia-manager");
        if (!materiaSlot.materiaSlot.allowsHighGrade) {
            this.classList.add("materia-slot-overmeld");
        }
        this.classList.add("slot-materia-manager");
        if (editable) {
            this.addEventListener('mousedown', (ev) => {
                if (ev.altKey) {
                    this.materiaSlot.equippedMateria = null;
                    callback();
                    this.reformat();
                }
                else if (ev.ctrlKey) {
                    this.materiaSlot.locked = !this.materiaSlot.locked;
                    sheet.requestSave();
                    this.reformat();
                }
                else {
                    this.showPopup();
                }
                ev.stopPropagation();
                ev.preventDefault();
            });
            this.classList.add('editable');
        }
        else {
            this.classList.add('readonly');
        }
        const imageHolder = document.createElement("div");
        imageHolder.classList.add("materia-image-holder");
        this.image = document.createElement("img");
        this.text = document.createElement("span");
        this.overcap = 0;
        imageHolder.appendChild(this.image);
        this.appendChild(imageHolder);
        this.appendChild(this.text);
    }

    showPopup() {
        if (!this.popup) {
            this.popup = new SlotMateriaManagerPopup(this.sheet, this.materiaSlot, () => {
                this.callback();
                this.popupOpen = false;
                this.reformat();
            });
            this.appendChild(this.popup);
        }
        this.popup.show();
        this.popupOpen = true;
    }

    // eslint-disable-next-line accessor-pairs
    set popupOpen(open: boolean) {
        if (open) {
            this.classList.add('materia-manager-active');
        }
        else {
            this.classList.remove('materia-manager-active');
        }
    }


    reformat() {
        const currentMat = this.materiaSlot.equippedMateria;
        // TODO: can the ordering be improved here?
        let title: string;
        if (currentMat) {
            this.image.src = currentMat.iconUrl.toString();
            this.image.style.display = 'block';
            const displayedNumber = Math.max(0, currentMat.primaryStatValue - this._overcap);
            this.text.textContent = `+${displayedNumber} ${STAT_ABBREVIATIONS[currentMat.primaryStat]}`;
            this.classList.remove("materia-slot-empty");
            this.classList.add("materia-slot-full");
            title = `${formatMateriaTitle(currentMat)}\n\nAlt-click to remove.`;
        }
        else {
            this.image.style.display = 'none';
            this.text.textContent = 'Empty';
            this.classList.remove('materia-normal', 'materia-overcap', 'materia-overcap-major', 'materia-slot-full');
            // this.classList.remove('materia-slot-full', 'materia-normal', 'materia-overcap', 'materia-overcap-major')
            this.classList.add("materia-slot-empty");
            title = 'Click to select materia\n';
        }
        title += `\nCtrl-click to ${this.materiaSlot.locked ? 'unlock' : 'prevent auto-fill/solving from affecting this slot.'}.`;
        if (this.materiaSlot.locked) {
            this.classList.add('materia-slot-locked');
            this.classList.remove('materia-slot-unlocked');
            title = 'This slot is LOCKED. It will not be affected by auto-fill nor the solver.\n' + title;
        }
        else {
            this.classList.add('materia-slot-unlocked');
            this.classList.remove('materia-slot-locked');
        }
        this.title = title;
    }

    // eslint-disable-next-line accessor-pairs
    set overcap(overcap: number) {
        if (overcap === this._overcap) {
            return;
        }
        this.classList.remove('materia-normal', 'materia-overcap', 'materia-overcap-major');
        this._overcap = overcap;
        if ((this.materiaSlot.equippedMateria === undefined) || overcap <= 0) {
            this.classList.add('materia-normal');
        }
        else if (overcap < this.materiaSlot.equippedMateria.primaryStatValue) {
            this.classList.add('materia-overcap');
        }
        else {
            this.classList.add('materia-overcap-major');
        }
        this.reformat();
    }
}

export class SingleMateriaViewOnly extends HTMLElement {

    private readonly text: HTMLSpanElement;
    private readonly image: HTMLImageElement;

    constructor(materia: Materia) {
        super();
        this.classList.add("single-materia-view-only");
        const imageHolder = document.createElement("div");
        imageHolder.classList.add("materia-image-holder");
        this.image = document.createElement("img");
        this.text = document.createElement("span");
        imageHolder.appendChild(this.image);
        this.appendChild(imageHolder);
        this.appendChild(this.text);
        const currentMat = materia;
        this.image.src = currentMat.iconUrl.toString();
        this.image.style.display = 'block';
        const displayedNumber = currentMat.primaryStatValue;
        this.text.textContent = `+${displayedNumber} ${STAT_ABBREVIATIONS[currentMat.primaryStat]}`;
        this.classList.remove("materia-slot-empty");
        this.classList.add("materia-slot-full");
    }
}

export class MateriaCountDisplay extends HTMLElement {
    constructor(public readonly materia: Materia, public readonly count: number) {
        super();
        this.replaceChildren(
            quickElement('div', ['materia-count-quantity'], [document.createTextNode(count + 'x')]),
            new SingleMateriaViewOnly(materia));
        this.title = formatMateriaTitle(materia);
    }
}

export function formatMateriaTitle(materia: Materia): string {
    return `${materia.nameTranslation}: +${materia.primaryStatValue} ${STAT_FULL_NAMES[materia.primaryStat]}`;
}

export class SlotMateriaManagerPopup extends HTMLElement {

    constructor(private sheet: GearPlanSheet, private materiaSlot: MeldableMateriaSlot, private callback: () => void) {
        super();
        this.hide();
    }

    show() {
        const allMateria = this.sheet.getRelevantMateriaFor(this.materiaSlot);
        const typeMap: { [K in RawStatKey]?: Materia[] } = {};
        const stats: RawStatKey[] = [];
        const grades: number[] = [];
        for (const materia of allMateria) {
            if (materia.materiaGrade > this.materiaSlot.materiaSlot.maxGrade
                || materia.isHighGrade && !this.materiaSlot.materiaSlot.allowsHighGrade) {
                continue;
            }
            (typeMap[materia.primaryStat] = typeMap[materia.primaryStat] ?? []).push(materia);
            if (!stats.includes(materia.primaryStat)) {
                stats.push(materia.primaryStat);
            }
            if (!grades.includes(materia.materiaGrade)) {
                grades.push(materia.materiaGrade);
            }
        }
        grades.sort((grade1, grade2) => grade2 - grade1);
        const table = document.createElement("table");
        const body = table.createTBody();
        const headerRow = body.insertRow();
        // Blank top-left
        const topLeftCell = document.createElement("th");
        const trash = quickElement('div', ['materia-picker-remove'], [makeTrashIcon()]);
        trash.addEventListener('mousedown', (ev) => {
            this.submit(undefined);
            ev.stopPropagation();
        });
        topLeftCell.appendChild(trash);
        headerRow.appendChild(topLeftCell);
        for (const stat of stats) {
            const headerCell = document.createElement("th");
            headerCell.textContent = STAT_ABBREVIATIONS[stat];
            headerCell.classList.add('stat-' + stat);
            headerCell.classList.add('primary');
            headerRow.appendChild(headerCell);
        }
        for (const grade of grades) {
            const row = body.insertRow();
            row.insertCell().textContent = grade.toString();
            for (const stat of stats) {
                const materia = typeMap[stat]?.find(m => m.materiaGrade === grade);
                if (materia) {
                    const cell = row.insertCell();
                    cell.addEventListener('mousedown', (ev) => {
                        this.submit(materia);
                        ev.stopPropagation();
                    });
                    cell.title = formatMateriaTitle(materia);
                    const image = document.createElement("img");
                    image.src = materia.iconUrl.toString();
                    image.setAttribute('intrinsicsize', '80x80');
                    if (this.materiaSlot.equippedMateria === materia) {
                        cell.setAttribute("is-selected", "true");
                    }
                    // Needed in order to make selection outline work
                    cell.appendChild(document.createElement('span'));
                    image.classList.add('item-rarity-normal');
                    image.addEventListener('load', () => {
                        image.classList.add('loaded');
                    });
                    cell.appendChild(image);
                }
                else {
                    row.insertCell();
                }
            }
        }
        this.replaceChildren(table);
        const self = this;
        MODAL_CONTROL.setModal({
            modalElement: self,
            close() {
                self.hide();
            },
        });
        this.style.display = 'block';
        // this.addEventListener('mouseenter', e => {
        //     e.stopPropagation();
        // });
        this.title = '';
    }

    submit(materia: Materia | undefined) {
        this.materiaSlot.equippedMateria = materia;
        // TODO: should close specifically just this one
        MODAL_CONTROL.closeAll();
        this.callback();
    }

    hide() {
        this.style.display = 'none';
        this.callback();
    }
}

export class MateriaPriorityPicker extends HTMLElement {
    constructor(prioController: MateriaAutoFillController, sheet: GearPlanSheetGui) {
        super();
        // this.appendChild(document.createTextNode('Materia Prio Thing Here'));
        const header = document.createElement('span');
        header.textContent = 'Mat Prio: ';
        const fillModeDropdown = new FieldBoundDataSelect<MateriaAutoFillController, MateriaFillMode>(prioController, 'autoFillMode',
            (val: MateriaFillMode) => {
                switch (val) {
                    case "leave_empty":
                        return "Leave Empty";
                    case "autofill":
                        return "Prio Fill";
                    case "retain_slot_else_prio":
                        return "Keep Slot > Prio";
                    case "retain_item_else_prio":
                        return "Keep Item > Prio";
                    case "retain_slot":
                        return "Keep Slot > None";
                    case "retain_item":
                        return "Keep Item > None";
                    default:
                        return "?";
                }
            }, [...MATERIA_FILL_MODES]);
        fillModeDropdown.title = 'Control what happens when an item is selected.\n' +
            'Leave Empty: Do not fill any materia when selecting an item.\n' +
            'Prio Fill: Fill materia slots according to the priority above.\n' +
            'Keep Slot, else Prio: Keep the same materia as the previously item in that slot. If none equipped, use priority.\n' +
            'Keep Item, else Prio: Remember what materia was equipped to each item. If none equipped, use priority.\n' +
            'Keep Slot, else None: Keep the same materia as the previously item in that slot. If none equipped, leave empty.\n' +
            'Keep Item, else None: Remember what materia was equipped to each item. If none equipped, leave empty.';
        const fillModeLabel = labelFor("Fill Mode:", fillModeDropdown);
        fillModeDropdown.addListener((newValue) => {
            recordEvent("fillMode", {
                'mode': newValue,
            });
        });

        const fillEmptyNow = makeActionButton('Fill Empty', () => {
            prioController.fillEmpty();
            recordEvent("fillEmpty");
        }, 'Fill all empty materia slots according to the chosen priority.');
        const fillAllNow = makeActionButton('Fill All', () => {
            prioController.fillAll();
            recordEvent("fillAll");
        }, 'Empty out and re-fill all materia slots according to the chosen priority.');

        const lockAllEquipped = makeActionButton('Lock Filled', () => {
            prioController.lockFilled();
        }, 'Lock all equipped materia');
        lockAllEquipped.classList.add('narrow-button');

        const lockAllEmpty = makeActionButton('Lock Empty', () => {
            prioController.lockEmpty();
        }, 'Lock all empty materia slots');
        lockAllEmpty.classList.add('narrow-button');

        const unlockAll = makeActionButton('Unlock All', () => {
            prioController.unlockAll();
        }, 'Unlock all slots');
        unlockAll.classList.add('narrow-button');

        const unequipAll = makeActionButton('Remove Unlocked', () => {
            prioController.unequipUnlocked();
        }, 'Unequip all unlocked materia');
        unequipAll.classList.add('narrow-button');

        const tips = quickElement('div', ['meld-solver-tips'], ['Tip: Ctrl-click a materia slot to lock/unlock it. Alt-click to remove materia.']);

        const drag = new MateriaDragList(prioController);

        const minGcdText = document.createElement('span');
        minGcdText.textContent = 'Min GCD: ';

        const minGcdInput = new FieldBoundFloatField(prioController.prio, 'minGcd', {
            postValidators: [ctx => {
                const val = ctx.newValue;
                // Check if user typed more than 2 digits, weird math because floating point fun
                if (Math.round(val * 1000) % 10) {
                    ctx.failValidation("Enter at most two decimal points");
                }
                else if (val < 0) {
                    ctx.failValidation("Enter a positive number");
                }
                else if (val > MAX_GCD) {
                    ctx.failValidation("Cannot be greater than " + MAX_GCD);
                }
            }],
            fixDecimals: 2,
        });
        minGcdInput.addListener(val => {
            recordCurrentSheetEvent('currentSheet', {
                gcd: val,
            });
        });
        minGcdInput.title = 'Enter the minimum desired GCD in the form x.yz.\nSkS/SpS materia will be de-prioritized once this target GCD is met.';
        minGcdInput.classList.add('min-gcd-input');
        this.replaceChildren(header, drag,
            document.createElement('br'),
            minGcdText, minGcdInput,
            document.createElement('br'),
            fillModeLabel, fillModeDropdown,
            document.createElement('br'),
            fillEmptyNow, fillAllNow,
            document.createElement('br'),
            lockAllEquipped, lockAllEmpty, unlockAll, unequipAll,
            document.createElement('br'),
            tips
        );
    }
}

class MateriaDragger extends HTMLElement {

    index: number;
    readonly inner: HTMLElement;

    constructor(public stat: MateriaSubstat, index: number) {
        super();
        this.classList.add('materia-prio-dragger');
        this.classList.add('materia-dragger-stat-' + stat);
        this.index = index;
        this.inner = document.createElement('div');
        const span = document.createElement('span');
        const abbrev = STAT_ABBREVIATIONS[stat];
        this.title = `Drag to change the priority of ${abbrev} materia relative to other types.`;
        span.textContent = abbrev;
        this.inner.appendChild(span);
        this.inner.classList.add('materia-dragger-inner');
        this.inner.classList.add('stat-' + stat);
        // TODO: make something specifically for this
        this.inner.classList.add('secondary');
        this.inner.classList.add('color-stat-column');
        this.appendChild(this.inner);
        // this.draggable = true;
    }

    // eslint-disable-next-line accessor-pairs
    set xOffset(xOffset: number) {
        let newOffset;
        if (xOffset > this.clientWidth) {
            newOffset = this.clientWidth;
        }
        else if (-xOffset > this.clientWidth) {
            newOffset = -this.clientWidth;
        }
        else {
            newOffset = xOffset;
        }
        this.inner.style.left = newOffset + 'px';

    }

}

export class MateriaDragList extends HTMLElement {

    private subOptions: MateriaDragger[] = [];
    private currentlyDragging: MateriaDragger | undefined;
    private currentDropIndex: number;
    private readonly moveListener: (ev: PointerEvent) => void;
    private readonly upListener: (ev: PointerEvent) => unknown;

    constructor(private prioController: MateriaAutoFillController) {
        super();
        this.style.position = 'relative';
        const statPrio = prioController.prio.statPrio;
        for (let i = 0; i < statPrio.length; i++) {
            const stat = statPrio[i];
            const dragger = new MateriaDragger(stat, i);
            this.subOptions.push(dragger);
            dragger.addEventListener('pointerdown', (ev) => {
                this.currentlyDragging = dragger;
                this.enableEvents();
                ev.preventDefault();
                // TODO: check if still needed
                document.body.style.cursor = 'grabbing';
            });
            // Prevents touchscreen scrolling
            dragger.addEventListener('touchstart', ev => ev.preventDefault());
        }
        this.moveListener = (ev: PointerEvent) => this.handleMouseMove(ev);
        this.upListener = (ev: PointerEvent) => this.handleMouseUp(ev);
        // this.addEventListener('pointermove', this.moveListener);
        this.fixChildren();
    }

    private enableEvents() {
        window.addEventListener('pointermove', this.moveListener);
        window.addEventListener('pointerup', this.upListener);
    }

    private disableEvents() {
        window.removeEventListener('pointermove', this.moveListener);
        window.removeEventListener('pointerup', this.upListener);
    }

    // noinspection JSUnusedGlobalSymbols
    disconnectedCallback() {
        this.disableEvents();
    }


    private handleMouseUp(ev: PointerEvent) {
        ev.preventDefault();
        if (this.currentlyDragging) {
            this.currentlyDragging.xOffset = 0;
        }
        this.disableEvents();
        this.finishMovement();
        this.currentlyDragging = undefined;
        document.body.style.cursor = '';
        // this.classList.remove('drag-active');
    }

    private handleMouseMove(ev: PointerEvent) {
        if (this.currentlyDragging === undefined) {
            return;
        }
        ev.preventDefault();
        const offsetFromThis = ev.clientX - this.getBoundingClientRect().left;
        for (let i = 0; i < this.subOptions.length; i++) {
            const subOption = this.subOptions[i];
            // Even though we care about the center, we don't divide the width by two because we also need to factor
            // in the width of the thing we're dragging (since it is positioned such that it is centered around the
            // drag cursor).
            const xCenter = subOption.offsetLeft + (subOption.offsetWidth);
            // We want to find the leftmost item that we are to the right of
            if (offsetFromThis <= xCenter) {
                this.currentDropIndex = i;
                break;
            }
        }
        this.processMovement();
        const draggeeOffset = ev.clientX - this.currentlyDragging.getBoundingClientRect().left - (this.currentlyDragging.offsetWidth / 2);
        this.currentlyDragging.xOffset = draggeeOffset;
    }

    private fixChildren() {
        for (let i = 0; i < this.subOptions.length; i++) {
            this.subOptions[i].index = i;
        }
        this.replaceChildren(...this.subOptions);
    }

    private processMovement() {
        const from = this.currentlyDragging ? this.subOptions.indexOf(this.currentlyDragging) : -1;
        const to = this.currentDropIndex;
        if (from === to) {
            return;
        }
        if (from < 0 || to < 0) {
            return;
        }
        this.subOptions.splice(to, 0, this.subOptions.splice(from, 1)[0]);
        this.currentDropIndex = -1;
        this.fixChildren();
    }

    private finishMovement() {
        this.prioController.prio.statPrio = this.subOptions.map(option => option.stat);
        this.prioController.callback();
    }

}

export class MateriaTotalsDisplay extends HTMLElement {
    public readonly empty: boolean;

    constructor(gearSet: CharacterGearSet) {
        super();
        const materiaCounts = new Map<number, Materia[]>();
        for (const equipSlot of EquipSlots) {
            const equip = gearSet.equipment[equipSlot];
            if (equip) {
                for (const meld of equip.melds) {
                    const materia = meld.equippedMateria;
                    if (materia) {
                        const id = materia.id;
                        const materias = materiaCounts.get(id);
                        if (materias) {
                            materias.push(materia);
                        }
                        else {
                            materiaCounts.set(id, [materia]);
                        }
                    }
                }
            }
        }
        const elements: MateriaCountDisplay[] = [];
        materiaCounts.forEach((value, key) => {
            elements.push(new MateriaCountDisplay(value[0], value.length));
        });
        elements.sort((left, right) => {
            const primary = right.count - left.count;
            if (primary === 0) {
                return (right.materia.id - left.materia.id);
            }
            return primary;
        });
        const totalsText = quickElement('div', ['materia-totals-label'], ['Totals:']);
        const inner = quickElement('div', ['materia-totals-inner'], elements);
        this.replaceChildren(totalsText, inner);
        this.empty = elements.length === 0;
    }

}

customElements.define("all-slot-materia-manager", AllSlotMateriaManager);
customElements.define("slot-materia-manager", SlotMateriaManager);
customElements.define("single-materia-view-only", SingleMateriaViewOnly);
customElements.define("materia-count-display", MateriaCountDisplay);
customElements.define("materia-totals-display", MateriaTotalsDisplay);
customElements.define("slot-materia-popup", SlotMateriaManagerPopup);
customElements.define("materia-priority-picker", MateriaPriorityPicker);
customElements.define("materia-drag-order", MateriaDragList);
customElements.define("materia-dragger", MateriaDragger);

