import {SheetProvider} from "@xivgear/core/sheet";
import {SHEET_MANAGER} from "../../saved_sheet_impl";
import {SetExport, SheetExport} from "@xivgear/xivmath/geartypes";
import {GearPlanSheetGui} from "./sheet_gui";
import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";

export class GraphicalSheetProvider extends SheetProvider<GearPlanSheetGui> {
    constructor() {
        super((...args) => new GearPlanSheetGui(...args), SHEET_MANAGER);
    }

    override fromExport(importedData: SheetExport): GearPlanSheetGui {
        const out = super.fromExport(importedData);
        out.setSelectFirstRowByDefault();
        return out;
    }

    override fromSetExport(...importedData: SetExport[]): GearPlanSheetGui {
        const out = super.fromSetExport(...importedData);
        out.setSelectFirstRowByDefault();
        return out;
    }

    override fromSaved(sheetKey: string): GearPlanSheetGui | null {
        const out = super.fromSaved(sheetKey);
        out?.setSelectFirstRowByDefault();
        return out;
    }

    override fromScratch(sheetKey: string, sheetName: string, classJob: JobName, level: SupportedLevel, ilvlSync: number | undefined, multiJob: boolean): GearPlanSheetGui {
        const out = super.fromScratch(sheetKey, sheetName, classJob, level, ilvlSync, multiJob);
        out.setSelectFirstRowByDefault();
        return out;
    }
}

export const GRAPHICAL_SHEET_PROVIDER = new GraphicalSheetProvider();
