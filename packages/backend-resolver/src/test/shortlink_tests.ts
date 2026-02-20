import '../polyfills';
// import {expect} from "chai";
// import {buildStatsServer} from "../server_builder";
// import {SheetExport} from "@xivgear/xivmath/geartypes";

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
//             expect(response.statusCode).to.equal(200);
//             const json = response.json() as {url: string, embedUrl: string};
//             expect(json.url).to.be.ok;
//             expect(json.embedUrl).to.be.ok;
//             const u = new URL(json.url);
//             const ue = new URL(json.embedUrl);
//             const page = u.searchParams.get('page');
//             const pageE = ue.searchParams.get('page');
//             expect(page).to.equal('sl|test-uuid-1234');
//             expect(pageE).to.equal('embed|sl|test-uuid-1234');
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
//             expect(response.statusCode).to.equal(200);
//             const json = response.json() as {url: string, sets: {index: number, url: string, embedUrl: string}[]};
//             expect(json.url).to.be.ok;
//             const base = new URL(json.url);
//             expect(base.searchParams.get('page')).to.equal('sl|sheet-uuid-5678');
//             // Should have entries for indices 0 and 2
//             const indices = json.sets.map(s => s.index).sort((a, b) => a - b);
//             expect(indices).to.deep.equal([0, 2]);
//             for (const s of json.sets) {
//                 const setU = new URL(s.url);
//                 const setUE = new URL(s.embedUrl);
//                 expect(setU.searchParams.get('page')).to.equal('sl|sheet-uuid-5678');
//                 expect(setU.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
//                 expect(setUE.searchParams.get('page')).to.equal('embed|sl|sheet-uuid-5678');
//                 expect(setUE.searchParams.get('onlySetIndex')).to.equal(s.index.toString());
//             }
//         }
//         finally {
//             restore();
//         }
//     }).timeout(30_000);
// });
