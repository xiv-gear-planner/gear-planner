import '../polyfills';
import assert from "assert";
import {buildPreviewServer, buildStatsServer, EmbedCheckResponse} from "../server_builder";
import {SheetStatsExport, SheetExport, SetExportExternalSingle} from "@xivgear/xivmath/geartypes";
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
    describe("set fulldata endpoint", () => {
        const fastify = buildStatsServer();
        it("responds to health check", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/healthcheck',
            });
            assert.equal(response.statusCode, 200);
        });
        it("can serve correct data", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501',
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as SheetStatsExport;
            assert.equal(json.name, "WHM 6.4 copy");
            assert.equal(json.level, 90);
            assert.equal(json.job, "WHM");
            assert.equal(json.race, "Xaela");
            assert.equal(json.partyBonus, 0);
            assert.equal(json.sets.length, 13);
            const firstSet = json.sets[0];
            assert.equal(firstSet.name, "6.4 Never gonna");
            assert.equal(firstSet.items.Weapon?.id, 40173);
            const stats = firstSet.computedStats;
            assert.equal(stats.hp, 74421);
            assert.equal(stats.mind, 3374);
        }).timeout(30_000);
        it("can serve correct data with party size 0", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=0',
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as SheetStatsExport;
            assert.equal(json.name, "WHM 6.4 copy");
            assert.equal(json.level, 90);
            assert.equal(json.job, "WHM");
            assert.equal(json.race, "Xaela");
            assert.equal(json.partyBonus, 0);
            assert.equal(json.sets.length, 13);
            const firstSet = json.sets[0];
            assert.equal(firstSet.name, "6.4 Never gonna");
            assert.equal(firstSet.items.Weapon?.id, 40173);
            const stats = firstSet.computedStats;
            assert.equal(stats.hp, 74421);
            assert.equal(stats.mind, 3374);
        }).timeout(30_000);
        it("can serve correct data with party size 5", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=5',
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as SheetStatsExport;
            assert.equal(json.name, "WHM 6.4 copy");
            assert.equal(json.level, 90);
            assert.equal(json.job, "WHM");
            assert.equal(json.race, "Xaela");
            assert.equal(json.partyBonus, 5);
            assert.equal(json.sets.length, 13);
            const firstSet = json.sets[0];
            assert.equal(firstSet.name, "6.4 Never gonna");
            assert.equal(firstSet.items.Weapon?.id, 40173);
            const stats = firstSet.computedStats;
            assert.equal(stats.mind, 3542);
            assert.equal(stats.hp, 78455);
        }).timeout(30_000);
    });
    describe("preview endpoint", () => {
        const fastify = buildPreviewServer();
        const parser = new DOMParser();
        const slTitle = 'WHM 6.4 copy - XivGear - FFXIV Gear Planner';
        it("resolves shortlink", async () => {
            const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|${uuid}`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title')?.textContent, slTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=WHM");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const shortlinkPreload = preloads[preloads.length - 1];
            assert.equal(shortlinkPreload.getAttribute('rel'), "preload");
            assert.equal(shortlinkPreload.getAttribute('href'), `https://api.xivgear.app/shortlink/${uuid}`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], slTitle);
        }).timeout(30_000);
        it("resolves shortlink with trailing slash", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|f9b260a9-650c-445a-b3eb-c56d8d968501`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title')?.textContent, slTitle);
        }).timeout(30_000);
        it("resolves shortlink with set selection index", async () => {
            const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|${uuid}&selectedIndex=3`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title')?.textContent, slTitle);


            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=WHM");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const shortlinkPreload = preloads[preloads.length - 1];
            assert.equal(shortlinkPreload.getAttribute('rel'), "preload");
            assert.equal(shortlinkPreload.getAttribute('href'), `https://api.xivgear.app/shortlink/${uuid}`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], slTitle);
        }).timeout(30_000);
        it("resolves shortlink exclusive set index", async () => {
            const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|${uuid}&onlySetIndex=3`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            const setTitle = '6.4 Week 1 2.43 b - XivGear - FFXIV Gear Planner';
            assert.equal(parsed.querySelector('title')?.textContent, setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=WHM");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const shortlinkPreload = preloads[preloads.length - 1];
            assert.equal(shortlinkPreload.getAttribute('rel'), "preload");
            assert.equal(shortlinkPreload.getAttribute('href'), `https://api.xivgear.app/shortlink/${uuid}`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], setTitle);
        }).timeout(30_000);
        const bisTitle = '6.55 Savage SGE BiS - XivGear - FFXIV Gear Planner';
        it("resolves bis link", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|archive|anabaseios`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title')?.textContent, bisTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=SGE");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const shortlinkPreload = preloads[preloads.length - 1];
            assert.equal(shortlinkPreload.getAttribute('rel'), "preload");
            assert.equal(shortlinkPreload.getAttribute('href'), `https://staticbis.xivgear.app/sge/archive/anabaseios.json`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], bisTitle);
        }).timeout(30_000);
        it("recovers from invalid bis link", async () => {
            {
                const badResponse = await fastify.inject({
                    method: 'GET',
                    url: `/?page=${BIS_HASH}|pld|`,
                });
                assert.equal(badResponse.statusCode, 200);
                const parsed = parser.parseFromString(badResponse.body, 'text/html');
                assert.equal(parsed.querySelector('title')?.textContent, 'XivGear - FFXIV Gear Planner');
            }

            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|archive|anabaseios`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title')?.textContent, bisTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=SGE");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const shortlinkPreload = preloads[preloads.length - 1];
            assert.equal(shortlinkPreload.getAttribute('rel'), "preload");
            assert.equal(shortlinkPreload.getAttribute('href'), `https://staticbis.xivgear.app/sge/archive/anabaseios.json`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], bisTitle);
        }).timeout(30_000);
        it("resolves bis link with onlySetIndex", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|archive|anabaseios&onlySetIndex=2`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = '2.45 Non-Relic - XivGear - FFXIV Gear Planner';
            const setDesc = '(6.4) - Same as WHM 2.45. Lowest piety but highest DPS.\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            assert.equal(parsed.querySelector('title')?.textContent, setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=SGE");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const shortlinkPreload = preloads[preloads.length - 1];
            assert.equal(shortlinkPreload.getAttribute('rel'), "preload");
            assert.equal(shortlinkPreload.getAttribute('href'), `https://staticbis.xivgear.app/sge/archive/anabaseios.json`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], setTitle);
            assert.equal(props['og:description'], setDesc);
        }).timeout(30_000);
        it("resolves bisbrowser link with no job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            assert.equal(parsed.querySelector('title')?.textContent, setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1 - (ALL_COMBAT_JOBS.length)];
            assert.equal(bisIndexPreload.getAttribute('rel'), "preload");
            assert.equal(bisIndexPreload.getAttribute('href'), 'https://staticbis.xivgear.app/_index.json');
            assert.equal(bisIndexPreload.getAttribute('as'), "fetch");
            assert.equal(bisIndexPreload.hasAttribute('crossorigin'), true);

            assert.equal(bisIndexPreload.getAttribute('rel'), "preload");
            assert.equal(bisIndexPreload.getAttribute('href'), 'https://staticbis.xivgear.app/_index.json');
            assert.equal(bisIndexPreload.getAttribute('as'), "fetch");
            assert.equal(bisIndexPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], setTitle);
            assert.equal(props['og:description'], setDesc);
        }).timeout(30_000);
        it("resolves bisbrowser link with a job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|sge|archive`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'SGE Archive BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for SGE Archive in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            assert.equal(parsed.querySelector('title')?.textContent, setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1];
            assert.equal(bisIndexPreload.getAttribute('rel'), "preload");
            assert.equal(bisIndexPreload.getAttribute('href'), 'https://staticbis.xivgear.app/_index.json');
            assert.equal(bisIndexPreload.getAttribute('as'), "fetch");
            assert.equal(bisIndexPreload.hasAttribute('crossorigin'), true);

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=SGE");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], setTitle);
            assert.equal(props['og:description'], setDesc);
        }).timeout(30_000);
        it("resolves invalid bisbrowser link with no job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|foo|bar`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'Foo Bar BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for Foo Bar in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            assert.equal(parsed.querySelector('title')?.textContent, setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1];
            assert.equal(bisIndexPreload.getAttribute('rel'), "preload");
            assert.equal(bisIndexPreload.getAttribute('href'), 'https://staticbis.xivgear.app/_index.json');
            assert.equal(bisIndexPreload.getAttribute('as'), "fetch");
            assert.equal(bisIndexPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], setTitle);
            assert.equal(props['og:description'], setDesc);
        }).timeout(30_000);
        it("resolves invalid bisbrowser link with a job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|sge|endwalker2`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'SGE Endwalker2 BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for SGE Endwalker2 in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            assert.equal(parsed.querySelector('title')?.textContent, setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1];
            assert.equal(bisIndexPreload.getAttribute('rel'), "preload");
            assert.equal(bisIndexPreload.getAttribute('href'), 'https://staticbis.xivgear.app/_index.json');
            assert.equal(bisIndexPreload.getAttribute('as'), "fetch");
            assert.equal(bisIndexPreload.hasAttribute('crossorigin'), true);

            const jobPreload = preloads[preloads.length - 2];
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=SGE");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
            assert.equal(jobPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], setTitle);
            assert.equal(props['og:description'], setDesc);
        }).timeout(30_000);
    });
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
            // Should resolve the same sheet as in fulldata test
            assert.equal(json.name, 'WHM 6.4 copy');
        }).timeout(30_000);
    });

    describe("shortlink put endpoints", () => {
        function mockShortlinkPost(uuid: string) {
            const originalFetch: typeof fetch = globalThis.fetch as typeof fetch;
            const mocked: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                let urlStr: string;
                if (typeof input === 'string') {
                    urlStr = input;
                }
                else if (input instanceof URL) {
                    urlStr = input.toString();
                }
                else {
                    urlStr = (input as Request).url;
                }
                if (urlStr === 'https://api.xivgear.app/shortlink/' && (!init || init.method === 'POST')) {
                    return new Response(uuid, {status: 200});
                }
                return originalFetch(input, init);
            }) as typeof fetch;
            globalThis.fetch = mocked;
            return () => {
                globalThis.fetch = originalFetch;
            };
        }

        const fastify = buildStatsServer();

        it("PUT /putset returns normal and embed urls", async () => {
            const restore = mockShortlinkPost('test-uuid-1234');
            try {
                const response = await fastify.inject({
                    method: 'PUT',
                    url: '/putset',
                    payload: { name: 'Test Set', items: {} },
                });
                assert.equal(response.statusCode, 200);
                const json = response.json() as {url: string, embedUrl: string};
                assert.ok(json.url);
                assert.ok(json.embedUrl);
                const u = new URL(json.url);
                const ue = new URL(json.embedUrl);
                const page = u.searchParams.get('page');
                const pageE = ue.searchParams.get('page');
                assert.equal(page, 'sl|test-uuid-1234');
                assert.equal(pageE, 'embed|sl|test-uuid-1234');
            }
            finally {
                restore();
            }
        }).timeout(30_000);

        it("PUT /putsheet returns per-set normal and embed urls", async () => {
            const restore = mockShortlinkPost('sheet-uuid-5678');
            try {
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
                assert.equal(response.statusCode, 200);
                const json = response.json() as {url: string, sets: {index: number, url: string, embedUrl: string}[]};
                assert.ok(json.url);
                const base = new URL(json.url);
                assert.equal(base.searchParams.get('page'), 'sl|sheet-uuid-5678');
                // Should have entries for indices 0 and 2
                const indices = json.sets.map(s => s.index).sort((a, b) => a - b);
                assert.deepStrictEqual(indices, [0, 2]);
                for (const s of json.sets) {
                    const setU = new URL(s.url);
                    const setUE = new URL(s.embedUrl);
                    assert.equal(setU.searchParams.get('page'), 'sl|sheet-uuid-5678');
                    assert.equal(setU.searchParams.get('onlySetIndex'), s.index.toString());
                    assert.equal(setUE.searchParams.get('page'), 'embed|sl|sheet-uuid-5678');
                    assert.equal(setUE.searchParams.get('onlySetIndex'), s.index.toString());
                }
            }
            finally {
                restore();
            }
        }).timeout(30_000);
    });

    describe("validateEmbed endpoint", () => {
        const fastify = buildStatsServer();
        it('passes BiS with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|${BIS_HASH}|sge|archive|anabaseios&onlySetIndex=2`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as EmbedCheckResponse;
            assert.deepStrictEqual(json, {
                isValid: true,
            } satisfies EmbedCheckResponse);
        });
        it('rejects BiS without onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|${BIS_HASH}|sge|archive|anabaseios`,
            });
            const json = response.json() as EmbedCheckResponse;
            assert.deepStrictEqual(json, {
                isValid: false,
                reason: 'full sheets cannot be embedded',
            } satisfies EmbedCheckResponse);
        });
        it('rejects BiS without embed', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=${BIS_HASH}|sge|archive|anabaseios&onlySetIndex=2`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as EmbedCheckResponse;
            assert.deepStrictEqual(json, {
                isValid: false,
                reason: 'not an embed',
            } satisfies EmbedCheckResponse);
        });
        it('passes full-sheet shortlink with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|sl|14433fae-67c1-4727-b772-54a07914fc03&onlySetIndex=2`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as EmbedCheckResponse;
            assert.deepStrictEqual(json, {
                isValid: true,
            } satisfies EmbedCheckResponse);
        });
        it('rejects full-sheet shortlink without onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|sl|14433fae-67c1-4727-b772-54a07914fc03`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as EmbedCheckResponse;
            assert.deepStrictEqual(json, {
                isValid: false,
                reason: 'full sheets cannot be embedded',
            } satisfies EmbedCheckResponse);
        });
        it('passes single-set shortlink with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|sl|0cd5874c-6322-4396-99be-2089d6222d9c`,
            });
            assert.equal(response.statusCode, 200);
            const json = response.json() as EmbedCheckResponse;
            assert.deepStrictEqual(json, {
                isValid: true,
            } satisfies EmbedCheckResponse);
        });
    });
});
