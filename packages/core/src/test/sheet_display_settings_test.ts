import {expect} from "chai";
import {SheetExport} from "@xivgear/xivmath/geartypes";
import {ExportTypes, HEADLESS_SHEET_PROVIDER} from "../sheet";

describe('sheet display settings', () => {
    it('preserves custom column keys when importing and exporting a sheet', () => {
        const importedData: SheetExport = {
            name: 'Display settings test',
            job: 'WHM',
            level: 100,
            sets: [],
            sheetDisplaySettings: {
                customColumns: ['defense', 'future-column'],
            },
        };
        const sheet = HEADLESS_SHEET_PROVIDER.fromExport(importedData);

        const exportedData = sheet.exportSheet(ExportTypes.ExternalExport);

        expect(exportedData.sheetDisplaySettings?.customColumns).to.deep.equal(['defense', 'future-column']);
    });
});
