import {GearPlanSheet} from "@xivgear/core/sheet";
import {CharacterGearSet} from "@xivgear/core/gear";
import {getCurrentHash, getCurrentState} from "../../../nav_hash";
import {makeUrl, NavState, ONLY_SET_QUERY_PARAM} from "@xivgear/core/nav/common_nav";
import {recordSheetEvent} from "../../../analytics/analytics";
import {MateriaTotalsDisplay} from "./materia";
import {EquipSlotKey, EquipSlots, GearItem} from "@xivgear/xivmath/geartypes";
import {FoodItemViewTable, GearItemsViewTable} from "./items";
import {SetViewToolbar} from "../toolbar/totals_display";
import {ExpandableText} from "@xivgear/common-ui/components/expandy_text";
import {stringToParagraphs} from "../../../util/text_utils";

/**
 * A simplified, read-only view for a set
 */
export class GearSetViewer extends HTMLElement {
    private readonly sheet: GearPlanSheet;
    private readonly gearSet: CharacterGearSet;

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.sheet = sheet;
        this.gearSet = gearSet;
        this.setup();
    }

    setup() {
        // const header = document.createElement("h1");
        // header.textContent = "Gear Set Editor";
        // this.appendChild(header)
        this.replaceChildren();

        // Name editor
        const heading = document.createElement('h1');
        if (this.sheet.isEmbed) {
            const headingLink = document.createElement('a');
            const hash = getCurrentHash();
            const linkUrl = makeUrl(new NavState(hash.slice(1), undefined, getCurrentState().onlySetIndex));
            linkUrl.searchParams.delete(ONLY_SET_QUERY_PARAM);
            headingLink.href = linkUrl.toString();
            headingLink.target = '_blank';
            headingLink.addEventListener('click', () => {
                recordSheetEvent("openEmbedToFull", this.sheet);
            });
            headingLink.replaceChildren(this.gearSet.name);
            heading.replaceChildren(headingLink);
        }
        else {
            heading.textContent = this.gearSet.name;
        }
        this.appendChild(heading);

        if (this.gearSet.description) {
            const descContainer = makeDescriptionHolder(this.gearSet.description);
            this.appendChild(descContainer);
        }

        const anchorForEmbed = document.createElement('a');
        anchorForEmbed.id = 'embed-stats-placeholder';
        this.appendChild(anchorForEmbed);

        if (!this.sheet.isEmbed) {
            const matTotals = new MateriaTotalsDisplay(this.gearSet);
            if (!matTotals.empty) {
                this.appendChild(matTotals);
            }
        }

        // We only care about equipped items
        const itemMapping: Map<EquipSlotKey, GearItem> = new Map();
        const equippedSlots = [];
        for (const slot of EquipSlots) {
            const equipped: GearItem = this.gearSet.getItemInSlot(slot);
            if (equipped) {
                itemMapping.set(slot, equipped);
                equippedSlots.push(slot);
            }
        }

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingRight', 'RingLeft'] as const;

        if (itemMapping.get('Weapon') || itemMapping.get('OffHand')) {
            const weaponTable = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, this.gearSet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon']);
            weaponTable.classList.add('weapon-table');
            this.appendChild(weaponTable);
        }
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        let leftEnabled = false;
        let rightEnabled = false;
        for (const slot of leftSideSlots) {
            if (itemMapping.get(slot)) {
                const table = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, [slot]);
                leftSideDiv.appendChild(table);
                leftEnabled = true;
            }
        }
        for (const slot of rightSideSlots) {
            if (itemMapping.get(slot)) {
                const table = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, [slot]);
                rightSideDiv.appendChild(table);
                rightEnabled = true;
            }
        }

        const gearTableSet = document.createElement('div');
        gearTableSet.classList.add('gear-table-sides-holder');
        leftSideDiv.classList.add('left-side-gear-table');
        rightSideDiv.classList.add('right-side-gear-table');

        if (leftEnabled) {
            gearTableSet.appendChild(leftSideDiv);
        }
        if (rightEnabled) {
            gearTableSet.appendChild(rightSideDiv);
        }
        this.appendChild(gearTableSet);

        // Food table TODO make readonly
        const food = this.gearSet.food;
        if (food) {
            const foodTable = new FoodItemViewTable(this.sheet, this.gearSet, food);
            foodTable.classList.add('food-view-table');
            // foodTable.id = "food-items-table";
            this.appendChild(foodTable);
        }
    }

    get toolbar(): Node {
        return new SetViewToolbar(this.gearSet);
    }

    // noinspection JSUnusedGlobalSymbols
    refresh() {
        // Avoids an error in the console in view-only mode
    }
}

function makeDescriptionHolder(text: string): HTMLElement {
    const fullParagraphs = stringToParagraphs(text);
    const out = new ExpandableText();
    out.classList.add('set-description-holder');
    out.setChildren(fullParagraphs);
    return out;
}

customElements.define("gear-set-viewer", GearSetViewer);
