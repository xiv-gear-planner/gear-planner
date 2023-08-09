import {CharacterGearSet, EquippedItem} from "../gear";
import {AutoMateriaPriority, EquipmentSet, Materia, MeldableMateriaSlot, RawStatKey, Substat} from "../geartypes";
import {MateriaSubstat, STAT_ABBREVIATIONS, STAT_FULL_NAMES} from "../xivconstants";
import {closeModal, setModal} from "../modalcontrol";
import {GearPlanSheet} from "../components";
import {FieldBoundCheckBox, labeledCheckbox, makeActionButton, quickElement} from "./util";

/**
 * Component for managing all materia slots on an item
 */
export class AllSlotMateriaManager extends HTMLElement {
    private _children: SlotMateriaManager[] = [];

    constructor(private sheet: GearPlanSheet,
                private gearSet: CharacterGearSet,
                private slotName: keyof EquipmentSet,
                private extraCallback: () => void = () => {
                }) {
        super();
        this.refresh();
        this.classList.add("all-slots-materia-manager")
        this.updateColors();
    }

    notifyChange() {
        this.gearSet.forceRecalc();
        this.extraCallback();
        this.updateColors();
    }

    updateColors() {
        const children = [...this._children];
        if (children.length === 0) {
            return;
        }
        const materiaPartial: Materia[] = [];
        for (let i = 0; i < children.length; i++) {
            const slot = children[i];
            const materia = slot.materiaSlot.equippedMatiera;
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
                this.classList.remove("materia-manager-equipped")
                const textSpan = document.createElement("span");
                textSpan.textContent = "No materia slots on this item";
                this.replaceChildren(textSpan);
                this._children = [];
            }
            else {
                this._children = equipSlot.melds.map(meld => new SlotMateriaManager(this.sheet, meld, () => this.notifyChange()));
                this.replaceChildren(...this._children);
                this.classList.remove("materia-slot-no-equip");
                this.classList.remove("materia-slot-no-slots");
                this.classList.add("materia-manager-equipped")
            }
        }
        else {
            const textSpan = document.createElement("span");
            textSpan.textContent = "Select an item to meld materia";
            this.replaceChildren(textSpan);
            this.classList.add("materia-slot-no-equip");
            this.classList.remove("materia-slot-no-slots");
            this.classList.remove("materia-manager-equipped")
            this._children = [];
        }
    }
}

/**
 * UI for picking a single materia slot
 */
export class SlotMateriaManager extends HTMLElement {

    private popup: SlotMateriaManagerPopup | undefined;
    private text: HTMLSpanElement;
    private image: HTMLImageElement;
    private _overcap: number;

    constructor(private sheet: GearPlanSheet, public materiaSlot: MeldableMateriaSlot, private callback: () => void) {
        super();
        this.classList.add("slot-materia-manager");
        if (!materiaSlot.materiaSlot.allowsHighGrade) {
            this.classList.add("materia-slot-overmeld");
        }
        this.classList.add("slot-materia-manager");
        this.addEventListener('mousedown', (ev) => {
            this.showPopup();
            ev.stopPropagation();
        });
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

    set popupOpen(open: boolean) {
        if (open) {
            this.classList.add('materia-manager-active');
        }
        else {
            this.classList.remove('materia-manager-active');
        }
    }


    reformat() {
        const currentMat = this.materiaSlot.equippedMatiera;
        if (currentMat) {
            this.image.src = currentMat.iconUrl.toString();
            this.image.style.display = 'block';
            const displayedNumber = Math.max(0, currentMat.primaryStatValue - this._overcap);
            this.text.textContent = `+${displayedNumber} ${STAT_ABBREVIATIONS[currentMat.primaryStat]}`;
            this.classList.remove("materia-slot-empty")
            this.classList.add("materia-slot-full");
        }
        else {
            this.image.style.display = 'none';
            this.text.textContent = 'Empty';
            this.classList.remove('materia-normal', 'materia-overcap', 'materia-overcap-major')
            // this.classList.remove('materia-slot-full', 'materia-normal', 'materia-overcap', 'materia-overcap-major')
            this.classList.add("materia-slot-empty");
        }
    }

    // TODO: remove
    // setColor(overcap: 'normal' | 'overcap' | 'overcap-major') {
    //     switch (overcap) {
    //         case "normal":
    //             break;
    //         case "overcap":
    //             break;
    //         case "overcap-major":
    //             break;
    //
    //     }
    // }

    set overcap(overcap: number) {
        if (overcap === this._overcap) {
            return;
        }
        this.classList.remove('materia-normal', 'materia-overcap', 'materia-overcap-major')
        this._overcap = overcap;
        if ((this.materiaSlot.equippedMatiera === undefined) || overcap <= 0) {
            this.classList.add('materia-normal');
        }
        else if (overcap < this.materiaSlot.equippedMatiera.primaryStatValue) {
            this.classList.add('materia-overcap');
        }
        else {
            this.classList.add('materia-overcap-major');
        }
        this.reformat();
    }
}

export class SlotMateriaManagerPopup extends HTMLElement {

    constructor(private sheet: GearPlanSheet, private materiaSlot: MeldableMateriaSlot, private callback: () => void) {
        super();
        this.hide();
    }

    show() {
        const allMateria = this.sheet.relevantMateria;
        const typeMap: { [K in RawStatKey]?: Materia[] } = {};
        const stats: RawStatKey[] = [];
        const grades: number[] = [];
        for (let materia of allMateria) {
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
        const topLeft = quickElement('div', ['materia-picker-remove'], [document.createTextNode('X')]);
        topLeft.addEventListener('mousedown', (ev) => {
            this.submit(undefined);
            ev.stopPropagation();
        })
        topLeftCell.appendChild(topLeft);
        headerRow.appendChild(topLeftCell);
        for (let stat of stats) {
            const headerCell = document.createElement("th");
            headerCell.textContent = STAT_ABBREVIATIONS[stat];
            headerRow.appendChild(headerCell);
        }
        for (let grade of grades) {
            const row = body.insertRow();
            row.insertCell().textContent = grade.toString();
            for (let stat of stats) {
                const materia = typeMap[stat]?.find(m => m.materiaGrade === grade);
                if (materia) {
                    const cell = row.insertCell();
                    cell.addEventListener('mousedown', (ev) => {
                        this.submit(materia);
                        ev.stopPropagation();
                    });
                    cell.title = `${materia.name}: +${materia.primaryStatValue} ${STAT_FULL_NAMES[materia.primaryStat]}`;
                    const image = document.createElement("img");
                    image.src = materia.iconUrl.toString();
                    if (this.materiaSlot.equippedMatiera === materia) {
                        cell.setAttribute("is-selected", "true");
                    }
                    cell.appendChild(image);
                }
                else {
                    row.insertCell();
                }
            }
        }
        this.replaceChildren(table);
        const self = this;
        setModal({
            element: self,
            close() {
                self.hide();
            }
        });
        this.style.display = 'block';
    }

    submit(materia: Materia | undefined) {
        this.materiaSlot.equippedMatiera = materia;
        closeModal();
        this.callback();
    }

    hide() {
        this.style.display = 'none';
        this.callback();
    }
}

export class MateriaPriorityPicker extends HTMLElement {
    constructor(prioController: AutoMateriaPriority) {
        super();
        // this.appendChild(document.createTextNode('Materia Prio Thing Here'));
        const header = document.createElement('span');
        header.textContent = 'Materia Auto-fill (Drag to Rearrange Priority)';
        const cb = labeledCheckbox('Fill Newly Selected Items', new FieldBoundCheckBox(prioController, 'enabled'));
        const fillEmptyNow = makeActionButton('Fill Empty', () => prioController.fillEmpty());
        const fillAllNow = makeActionButton('Overwrite All', () => prioController.fillAll());
        const drag = new MateriaDragList(prioController);
        this.replaceChildren(header, drag, fillEmptyNow, fillAllNow, cb);
    }
}

class MateriaDragger extends HTMLElement {

    index: number;
    readonly inner: HTMLDivElement;

    constructor(public stat: MateriaSubstat, index: number) {
        super();
        this.index = index;
        this.inner = document.createElement('div');
        this.inner.textContent = STAT_ABBREVIATIONS[stat];
        this.inner.classList.add('materia-dragger-inner');
        this.inner.classList.add('stat-' + stat);
        // TODO: make something specifically for this
        this.inner.classList.add('secondary');
        this.inner.classList.add('color-stat-column');
        this.appendChild(this.inner);
        this.draggable = true;
    }

    set xOffset(xOffset: number) {
        this.inner.style.left = xOffset + 'px';

    }

}

export class MateriaDragList extends HTMLElement {

    private subOptions: MateriaDragger[] = [];
    private currentlyDragging: MateriaDragger | undefined;
    private currentDropIndex: number;

    constructor(private prioController: AutoMateriaPriority) {
        super();
        this.style.position = 'relative';
        const statPrio = prioController.statPrio;
        for (let i = 0; i < statPrio.length; i++) {
            let stat = statPrio[i];
            const dragger = new MateriaDragger(stat, i);
            dragger.classList.add('materia-prio-dragger');
            this.subOptions.push(dragger);
            dragger.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setDragImage(document.createElement('span'), 0, 0);
                this.currentlyDragging = dragger;
                // this.classList.add('drag-active');
            });
            dragger.addEventListener('dragend', (ev) => {
                ev.preventDefault();
                dragger.xOffset = 0;
                // this.classList.remove('drag-active');
            });
        }
        this.addEventListener('dragover', (ev) => {
            if (this.currentlyDragging === undefined) {
                return;
            }
            const offsetX = ev.offsetX - this.currentlyDragging.clientLeft - (this.currentlyDragging.offsetWidth / 2);
            this.currentlyDragging.xOffset = offsetX;
            if (this.currentlyDragging === ev.target) {
                ev.preventDefault();
                return;
            }
            if (ev.target instanceof MateriaDragger) {
                ev.preventDefault();
                this.currentDropIndex = this.subOptions.indexOf(ev.target);
            }
            // Stop processing if no movement
            else if (ev.target === this) {
                ev.preventDefault();
                let set = false;
                // console.log('Drag over', baseX, ev);
                for (let i = 0; i < this.subOptions.length; i++) {
                    let subOption = this.subOptions[i];
                    const xCenter = subOption.offsetLeft + (subOption.offsetWidth / 2);
                    // const xCenter = baseX + subOption.offsetLeft;
                    if (ev.offsetX > xCenter) {
                        // subOption.style.border = '3px solid red';
                    }
                    else {
                        // subOption.style.border = 'none';
                        if (!set) {
                            this.currentDropIndex = i;
                            set = true;
                        }
                    }
                }
            }
            else {
                return;
            }
            this.processDrop();
        });
        this.fixChildren();
    }

    private fixChildren() {
        for (let i = 0; i < this.subOptions.length; i++) {
            this.subOptions[i].index = i;
        }
        this.replaceChildren(...this.subOptions);
    }

    private processDrop() {
        const from = this.currentlyDragging ? this.subOptions.indexOf(this.currentlyDragging) : -1;
        const to = this.currentDropIndex;
        if (from < 0 || to < 0) {
            return;
        }
        this.subOptions.splice(to, 0, this.subOptions.splice(from, 1)[0]);
        this.prioController.statPrio = this.subOptions.map(option => option.stat);
        this.fixChildren();
    }
}

customElements.define("all-slot-materia-manager", AllSlotMateriaManager);
customElements.define("slot-materia-manager", SlotMateriaManager);
customElements.define("slot-materia-popup", SlotMateriaManagerPopup);
customElements.define("materia-priority-picker", MateriaPriorityPicker);
customElements.define("materia-drag-order", MateriaDragList);
customElements.define("materia-dragger", MateriaDragger);

