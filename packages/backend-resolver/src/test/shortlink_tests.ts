import '../polyfills';
import {expect} from "chai";
import {SheetExport} from "@xivgear/xivmath/geartypes";
import {makeStatsServer} from "./test_utils";

describe("shortlink put endpoints", () => {

    const fastify = makeStatsServer().setupForTest();

    it("PUT /putset returns normal and embed urls", async () => {
        const response = await fastify.inject({
            method: 'PUT',
            url: '/putset',
            payload: { name: 'Test Set', items: {} },
        });
        expect(response.statusCode).to.equal(200);
        const json = response.json() as {url: string, embedUrl: string};
        expect(json.url).to.be.ok;
        expect(json.embedUrl).to.be.ok;
        const u = new URL(json.url);
        const ue = new URL(json.embedUrl);
        const page = u.searchParams.get('page');
        const pageE = ue.searchParams.get('page');
        expect(page).to.match(/^sl\|[a-f0-9-]+$/);
        expect(pageE).to.match(/^embed\|sl\|[a-f0-9-]+$/);
    }).timeout(30_000);

    it("PUT /putsheet returns per-set normal and embed urls", async () => {
        const payload = {
            name: 'Sheet',
            sets: [
                { name: 'A', items: {} },
                { isSeparator: true },
                { name: 'B', items: {} },
            ],
        } as unknown as SheetExport;
        const response = await fastify.inject({
            method: 'PUT',
            url: '/putsheet',
            payload: payload,
        });
        expect(response.statusCode).to.equal(200);
        const json = response.json() as {url: string, sets: {index: number, url: string, embedUrl: string}[]};
        expect(json.url).to.be.ok;
        const base = new URL(json.url);
        expect(base.searchParams.get('page')).to.match(/^sl\|[a-f0-9-]+$/);
        const uuid = base.searchParams.get('page')!.split('|')[1];
        // Should have entries for indices 0 and 2
        const indices = json.sets.map(s => s.index).sort((a, b) => a - b);
        expect(indices).to.deep.equal([0, 2]);
        for (const s of json.sets) {
            const setU = new URL(s.url);
            const setUE = new URL(s.embedUrl);
            expect(setU.searchParams.get('page')).to.equal(`sl|${uuid}`);
            expect(setU.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
            expect(setUE.searchParams.get('page')).to.equal(`embed|sl|${uuid}`);
            expect(setUE.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
        }
    }).timeout(30_000);
});
