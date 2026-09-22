import '../polyfills';
import {expect} from "chai";
import {SheetExport} from "@xivgear/xivmath/geartypes";
import {makeStatsServer} from "./test_utils";
import {PutSetResponse, PutSheetResponse} from "../stats_server_schema_types";
import {splitUrlPath} from "@xivgear/core/nav/common_nav";

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
        const normalPath = splitUrlPath(normal.pathname);
        const embedPath = splitUrlPath(embed.pathname);
        expect(normalPath).to.have.length(2);
        expect(normalPath[0]).to.equal('sl');
        expect(normalPath[1]).to.match(/^[a-f0-9-]+$/);
        expect(embedPath).to.deep.equal(['embed', ...normalPath]);
        expect(normal.searchParams.get('page')).to.be.null;
        expect(embed.searchParams.get('page')).to.be.null;
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
        const basePath = splitUrlPath(base.pathname);
        expect(basePath).to.have.length(2);
        expect(basePath[0]).to.equal('sl');
        const uuid = basePath[1];
        expect(uuid).to.match(/^[a-f0-9-]+$/);
        // Should have entries for indices 0 and 2
        const indices = json.sets.map(s => s.index).sort((a, b) => a - b);
        expect(indices).to.deep.equal([0, 2]);
        for (const s of json.sets) {
            const normal = new URL(s.url);
            const embed = new URL(s.embedUrl);
            const preSelect = new URL(s.preSelectUrl);
            expect(splitUrlPath(normal.pathname)).to.deep.equal(['sl', uuid]);
            expect(normal.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
            expect(splitUrlPath(embed.pathname)).to.deep.equal(['embed', 'sl', uuid]);
            expect(embed.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
            expect(splitUrlPath(preSelect.pathname)).to.deep.equal(['sl', uuid]);
            expect(preSelect.searchParams.get('selectedIndex')).to.equal(s.index.toString());
        }
    }).timeout(30_000);
});
