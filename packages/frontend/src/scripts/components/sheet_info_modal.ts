import {BaseModal} from "@xivgear/common-ui/components/modal";
import {AnyStringIndex} from "@xivgear/util/util_types";
import {simpleKvTable} from "../sims/components/simple_tables";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {CharacterGearSet} from "@xivgear/core/gear";
import {quickElement} from "@xivgear/common-ui/components/util";
import {flp} from "@xivgear/xivmath/xivmath";

export class SheetInfoModal extends BaseModal {
    constructor(sheet: GearPlanSheet, selectedGearSet: CharacterGearSet | null) {
        super();
        this.headerText = 'Sheet Info';

        const data: AnyStringIndex = {
            "Sheet Name: ": sheet.sheetName,
            "Timestamp: ": sheet.timestamp.toUTCString(),
            "Job: ": sheet.classJobName,
            "Level: ": sheet.level.toString(),
            "iLvl Sync: ": sheet.ilvlSync === undefined ? "None" : sheet.ilvlSync.toString(),
        };
        const sheetTable = simpleKvTable(data);
        this.contentArea.appendChild(sheetTable);
        if (selectedGearSet) {
            const setData: AnyStringIndex = {
                "Set Name: ": selectedGearSet.name,
                "Average ilvl: ": flp(3, selectedGearSet.avgIlvl).toString(),
                "Defense: ": selectedGearSet.computedStats.defensePhys.toString(),
                "Magic Def: ": selectedGearSet.computedStats.defenseMag.toString(),
                "Defense Inc. Dmg.: ": selectedGearSet.computedStats.defenseDamageTaken.toFixed(2),
                "MDef Inc. Dmg.: ": selectedGearSet.computedStats.magicDefenseDamageTaken.toFixed(2),
            };
            const setTable = simpleKvTable(setData);
            this.contentArea.appendChild(quickElement('h3', [], ['Selected Set']));
            this.contentArea.appendChild(setTable);
        }
        else {
            this.contentArea.appendChild(quickElement('h3', [], ['No Set Selected']));
        }
    }
}

customElements.define('sheet-info-modal', SheetInfoModal);
