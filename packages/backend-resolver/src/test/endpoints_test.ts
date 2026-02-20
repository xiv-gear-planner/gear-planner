import '../polyfills';
import assert from "assert";
import {buildPreviewServer, buildStatsServer, EmbedCheckResponse} from "../server_builder";
import {SetExportExternalSingle, SheetExport, SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {BIS_BROWSER_HASH, BIS_HASH, SHORTLINK_HASH} from "@xivgear/core/nav/common_nav";
import {ALL_COMBAT_JOBS} from "@xivgear/xivmath/xivconstants";

function readPreviewProps(document: Document): Record<string, string> {
    const out: Record<string, string> = {};
    document.querySelectorAll("head meta")
        .forEach(meta => {
            const key = meta.getAttribute("property");
            if (key?.startsWith("og:")) {
                const value = meta.getAttribute("content");
                if (value !== null) {
                    out[key] = value;
                }
            }
        });
    return out;
}

// TODO: add tests for nonexistent UUIDs and other error cases
describe("backend servers", () => {
    describe("basedata endpoint", () => {
        const fastify = buildStatsServer();
        it("uses params from encoded url when not provided directly", async () => {
            const encoded = encodeURIComponent('https://foo.bar/?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501&onlySetIndex=1');
            const response = await fastify.inject({
                method: 'GET',
                url: `/basedata?url=${encoded}&onlySetIndex=2`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as SheetExport | SetExportExternalSingle;
            // Should resolve the same sheet as in fulldata test, but with onlySetIndex
            // It should take onlySetIndex=2 since direct URL params take priority over anything packed into the encoded url
            assert.equal(json.name, '6.4 Week 1 2.38');
        }).timeout(30_000);
    });

    describe("fulldata endpoint", () => {
        const fastify = buildStatsServer();
        it("uses params from encoded url when not provided directly", async () => {
            const encoded = encodeURIComponent('https://foo.bar/?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501&onlySetIndex=1');
            const response = await fastify.inject({
                method: 'GET',
                url: `/fulldata?url=${encoded}`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as SheetStatsExport;
            // When onlySetIndex is provided, it extracts that set and returns it as a SetExport (which is then wrapped by importExportSheet)
            // The name of the resulting SheetStatsExport will be the name of the set if it was extracted.
            assert.equal(json.name, '6.4 Week 1 2.43 a');
            assert.equal(json.sets.length, 1);
            assert.equal(json.sets[0].name, '6.4 Week 1 2.43 a');
        }).timeout(30_000);
    });

    describe("validateEmbed endpoint", () => {
        const fastify = buildStatsServer();
        it("uses params from encoded url for validateEmbed", async () => {
            const encoded = encodeURIComponent('https://foo.bar/?page=embed|sl|f9b260a9-650c-445a-b3eb-c56d8d968501&onlySetIndex=1');
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?url=${encoded}`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as EmbedCheckResponse;
            assert.strictEqual(json.isValid, true);
        }).timeout(30_000);
    });

    // describe("shortlink put endpoints", () => {
    //     function mockShortlinkPost(uuid: string) {
    //         const originalFetch: typeof fetch = globalThis.fetch as typeof fetch;
    //         const mocked: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    //             let urlStr: string;
    //             if (typeof input === 'string') {
    //                 urlStr = input;
    //             }
    //             else if (input instanceof URL) {
    //                 urlStr = input.toString();
    //             }
    //             else {
    //                 urlStr = (input as Request).url;
    //             }
    //             if (urlStr === 'https://api.xivgear.app/shortlink/' && (!init || init.method === 'POST')) {
    //                 return new Response(uuid, {status: 200});
    //             }
    //             return originalFetch(input, init);
    //         }) as typeof fetch;
    //         globalThis.fetch = mocked;
    //         return () => {
    //             globalThis.fetch = originalFetch;
    //         };
    //     }
    //
    //     const fastify = buildStatsServer();
    //
    //     it("PUT /putset returns normal and embed urls", async () => {
    //         const restore = mockShortlinkPost('test-uuid-1234');
    //         try {
    //             const response = await fastify.inject({
    //                 method: 'PUT',
    //                 url: '/putset',
    //                 payload: { name: 'Test Set', items: {} },
    //             });
    //             assert.equal(response.statusCode, 200);
    //             const json = response.json() as {url: string, embedUrl: string};
    //             assert.ok(json.url);
    //             assert.ok(json.embedUrl);
    //             const u = new URL(json.url);
    //             const ue = new URL(json.embedUrl);
    //             const page = u.searchParams.get('page');
    //             const pageE = ue.searchParams.get('page');
    //             assert.equal(page, 'sl|test-uuid-1234');
    //             assert.equal(pageE, 'embed|sl|test-uuid-1234');
    //         }
    //         finally {
    //             restore();
    //         }
    //     }).timeout(30_000);
    //
    //     it("PUT /putsheet returns per-set normal and embed urls", async () => {
    //         const restore = mockShortlinkPost('sheet-uuid-5678');
    //         try {
    //             const payload = {
    //                 name: 'Sheet',
    //                 sets: [
    //                     { name: 'A', items: {} },
    //                     { isSeparator: true },
    //                     { name: 'B', items: {} },
    //                 ],
    //             } as unknown as SheetExport;
    //             const response = await fastify.inject({
    //                 method: 'PUT',
    //                 url: '/putsheet',
    //                 payload: payload,
    //             });
    //             assert.equal(response.statusCode, 200);
    //             const json = response.json() as {url: string, sets: {index: number, url: string, embedUrl: string}[]};
    //             assert.ok(json.url);
    //             const base = new URL(json.url);
    //             assert.equal(base.searchParams.get('page'), 'sl|sheet-uuid-5678');
    //             // Should have entries for indices 0 and 2
    //             const indices = json.sets.map(s => s.index).sort((a, b) => a - b);
    //             assert.deepStrictEqual(indices, [0, 2]);
    //             for (const s of json.sets) {
    //                 const setU = new URL(s.url);
    //                 const setUE = new URL(s.embedUrl);
    //                 assert.equal(setU.searchParams.get('page'), 'sl|sheet-uuid-5678');
    //                 assert.equal(setU.searchParams.get('onlySetIndex'), s.index.toString());
    //                 assert.equal(setUE.searchParams.get('page'), 'embed|sl|sheet-uuid-5678');
    //                 assert.equal(setUE.searchParams.get('onlySetIndex'), s.index.toString());
    //             }
    //         }
    //         finally {
    //             restore();
    //         }
    //     }).timeout(30_000);
    // });
});
