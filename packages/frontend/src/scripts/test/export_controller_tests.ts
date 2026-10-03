import 'global-jsdom/register';
import {expect} from "chai";
import {
    exportSetToTeamcraft,
    finalizeXivgearUrl,
    formatExportLines,
    setJson,
    sheetJson
} from "../components/export/export_controller";

describe('export controller URL formatting', () => {
    it('normalizes links to the canonical slash format', () => {
        const result = finalizeXivgearUrl(new URL('https://xivgear.app/?page=sl|test-id&_cacheBust=1'));

        expect(result.pathname).to.equal('/sl/test-id');
        expect(result.searchParams.get('page')).to.be.null;
        expect(result.searchParams.get('_cacheBust')).to.be.null;
    });

    it('converts links to the legacy pipe format', () => {
        const result = finalizeXivgearUrl(new URL('https://xivgear.app/sl/test-id?onlySetIndex=2'), 'pipe');

        expect(result.pathname).to.equal('/');
        expect(result.searchParams.get('page')).to.equal('sl|test-id');
        expect(result.searchParams.get('onlySetIndex')).to.equal('2');
    });

    it('formats URL lines according to the selected link format', () => {
        const lines = [new URL('https://xivgear.app/sl/test-id'), 'This is not a URL'];

        expect(formatExportLines(lines, false)).to.deep.equal([
            'https://xivgear.app/sl/test-id',
            'This is not a URL',
        ]);
        expect(formatExportLines(lines, true)).to.deep.equal([
            'https://xivgear.app/?page=sl|test-id',
            'This is not a URL',
        ]);
    });

    it('exports a whole sheet as JSON', async () => {
        const sheet = {
            exportSheet: () => ({name: 'test sheet'}),
        } as never;

        const result = await sheetJson.doExport(sheet, false);

        expect(result).to.deep.equal(['{"name":"test sheet"}']);
    });

    it('exports an individual set as JSON', async () => {
        const set = {
            sheet: {
                exportGearSet: () => ({name: 'test set'}),
            },
        } as never;

        const result = await setJson.doExport(set, false);

        expect(result).to.deep.equal(['{"name":"test set"}']);
    });

    it('exports equipped items to Teamcraft', async () => {
        const set = {
            equipment: {
                Weapon: {
                    gearItem: {id: 100},
                    melds: [],
                },
                Head: {
                    gearItem: {id: 200},
                    melds: [],
                },
            },
        } as never;

        const result = await exportSetToTeamcraft.doExport(set, false);

        expect(result).to.have.length(1);
        const link = result[0] as string;
        expect(link).to.match(/^https:\/\/ffxivteamcraft\.com\/import\//);
        expect(atob(link.split('/').pop()!)).to.equal('100,null,1;200,null,1');
    });
});
