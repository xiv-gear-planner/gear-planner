import {CustomTable} from "../tables";
import {CustomItem} from "@xivgear/core/gear";
import {GearPlanSheet} from "@xivgear/core/sheet";

export class CustomItemTable extends CustomTable<CustomItem> {
    constructor(sheet: GearPlanSheet) {
        super();
    }
}