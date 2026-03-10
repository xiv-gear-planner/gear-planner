import '../polyfills';
import {expect} from "chai";
import {SheetExport} from "@xivgear/xivmath/geartypes";
import {makeStatsServer} from "./test_utils";
import {PutSetResponse, PutSheetResponse} from "../stats_server_schema_types";

describe("shortlink put endpoints", () => {

    const fastify = makeStatsServer().setupForTest();

    it("PUT /putset returns normal and embed urls", async () => {
        const response = await fastify.inject({
            method: 'PUT',
            url: '/putset',
            payload: {
                name: 'Test Set',
                items: {},
            },
        });
        expect(response.statusCode).to.equal(200);
        const json = response.json() as PutSetResponse;
        expect(json.url).to.be.ok;
        expect(json.embedUrl).to.be.ok;
        const normal = new URL(json.url);
        const embed = new URL(json.embedUrl);
        const pageNormal = normal.searchParams.get('page');
        const pageEmbed = embed.searchParams.get('page');
        expect(pageNormal).to.match(/^sl\|[a-f0-9-]+$/);
        expect(pageEmbed).to.match(/^embed\|sl\|[a-f0-9-]+$/);
    }).timeout(30_000);

    it("PUT /putsheet returns per-set normal and embed urls", async () => {
        const payload: SheetExport = {
            name: 'Sheet',
            job: 'SGE',
            level: 100,
            sims: [],
            sets: [
                {
                    name: 'A',
                    items: {},
                },
                {
                    name: 'Separator',
                    isSeparator: true,
                    // TODO: this really shouldn't be required
                    items: {},
                },
                {
                    name: 'B',
                    items: {},
                },
            ],
        };
        const response = await fastify.inject({
            method: 'PUT',
            url: '/putsheet',
            payload: payload,
        });
        expect(response.statusCode).to.equal(200);
        const json = response.json() as PutSheetResponse;
        expect(json.url).to.be.ok;
        const base = new URL(json.url);
        expect(base.searchParams.get('page')).to.match(/^sl\|[a-f0-9-]+$/);
        const uuid = base.searchParams.get('page')!.split('|')[1];
        // Should have entries for indices 0 and 2
        const indices = json.sets.map(s => s.index).sort((a, b) => a - b);
        expect(indices).to.deep.equal([0, 2]);
        for (const s of json.sets) {
            const normal = new URL(s.url);
            const embed = new URL(s.embedUrl);
            const preSelect = new URL(s.preSelectUrl);
            expect(normal.searchParams.get('page')).to.equal(`sl|${uuid}`);
            expect(normal.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
            expect(embed.searchParams.get('page')).to.equal(`embed|sl|${uuid}`);
            expect(embed.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
            expect(preSelect.searchParams.get('page')).to.equal(`sl|${uuid}`);
            expect(preSelect.searchParams.get('selectedIndex')).to.equal(s.index.toString());
        }
    }).timeout(30_000);
});
