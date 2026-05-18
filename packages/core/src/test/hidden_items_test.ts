import {ExportTypes, GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../sheet";
import {expect} from "chai";

describe('hidden items logic', () => {
    let sheet: GearPlanSheet;

    before(async () => {
        sheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "Hidden Items Test", "SGE", 90, 660, false);
        await sheet.load();
    });

    it('can hide and unhide gear items', () => {
        const item = sheet.itemsForDisplay[0];
        expect(sheet.isItemHidden(item)).to.be.false;

        sheet.setItemHidden(item, true);
        expect(sheet.isItemHidden(item)).to.be.true;

        sheet.setItemHidden(item, false);
        expect(sheet.isItemHidden(item)).to.be.false;
    });

    it('filters hidden items in itemsForDisplay', () => {
        const items = sheet.itemsForDisplay;
        const itemToHide = items[0];

        sheet.setItemHidden(itemToHide, true);

        expect(sheet.itemsForDisplay).to.not.contain(itemToHide);

        sheet.itemDisplaySettings.showHidden = true;
        expect(sheet.itemsForDisplay).to.contain(itemToHide);

        // Reset for next tests
        sheet.itemDisplaySettings.showHidden = false;
        sheet.setItemHidden(itemToHide, false);
    });

    it('can reset hidden items', () => {
        const items = sheet.itemsForDisplay;
        sheet.setItemHidden(items[0], true);
        sheet.setItemHidden(items[1], true);

        expect(sheet.itemsForDisplay).to.not.contain(items[0]);
        expect(sheet.itemsForDisplay).to.not.contain(items[1]);

        sheet.resetHiddenItems();

        expect(sheet.itemsForDisplay).to.contain(items[0]);
        expect(sheet.itemsForDisplay).to.contain(items[1]);
    });

    it('exports and imports hidden items flags correctly', async () => {
        const items = sheet.itemsForDisplay;
        const itemToHide = items[0];
        sheet.setItemHidden(itemToHide, true);

        // Test with InternalSave (which should include flags)
        const exportedInternal = sheet.exportSheet(ExportTypes.InternalSave);
        expect(exportedInternal.hiddenItems).to.contain(itemToHide.id);

        const importedInternal = HEADLESS_SHEET_PROVIDER.fromExport(exportedInternal);
        await importedInternal.load();
        expect(importedInternal.isItemHidden(itemToHide)).to.be.true;

        // Test with ExternalExport (which should NOT include flags)
        const exportedExternal = sheet.exportSheet(ExportTypes.ExternalExport);
        expect(exportedExternal.hiddenItems).to.be.undefined;

        const importedExternal = HEADLESS_SHEET_PROVIDER.fromExport(exportedExternal);
        await importedExternal.load();
        expect(importedExternal.isItemHidden(itemToHide)).to.be.false;
    });

    it('filters hidden food in foodItemsForDisplay', () => {
        const foods = sheet.foodItemsForDisplay;
        const foodToHide = foods[0];

        sheet.setItemHidden(foodToHide, true);

        expect(sheet.foodItemsForDisplay).to.not.contain(foodToHide);

        sheet.itemDisplaySettings.showHidden = true;
        expect(sheet.foodItemsForDisplay).to.contain(foodToHide);

        // Reset
        sheet.itemDisplaySettings.showHidden = false;
        sheet.setItemHidden(foodToHide, false);
    });
});
