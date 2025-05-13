import '../polyfills';
import assert from "assert";
import {buildPreviewServer, buildStatsServer, EmbedCheckResponse} from "../server_builder";
import {SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {BIS_BROWSER_HASH, BIS_HASH, SHORTLINK_HASH} from "@xivgear/core/nav/common_nav";
import {ALL_COMBAT_JOBS, JOB_IDS} from "@xivgear/xivmath/xivconstants";

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
                url: `/?page=${BIS_HASH}|sge|endwalker|anabaseios`,
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
            assert.equal(shortlinkPreload.getAttribute('href'), `https://staticbis.xivgear.app/sge/endwalker/anabaseios.json`);
            assert.equal(shortlinkPreload.getAttribute('as'), "fetch");
            assert.equal(shortlinkPreload.hasAttribute('crossorigin'), true);

            const props = readPreviewProps(parsed);
            assert.equal(props['og:site_name'], 'XivGear');
            assert.equal(props['og:type'], 'website');
            assert.equal(props['og:title'], bisTitle);
        }).timeout(30_000);
        it("resolves bis link with trailing slash", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|endwalker|anabaseios`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title')?.textContent, '6.55 Savage SGE BiS - XivGear - FFXIV Gear Planner');
        }).timeout(30_000);
        it("resolves bis link with onlySetIndex", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|endwalker|anabaseios&onlySetIndex=2`,
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
            assert.equal(shortlinkPreload.getAttribute('href'), `https://staticbis.xivgear.app/sge/endwalker/anabaseios.json`);
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
                url: `/?page=${BIS_BROWSER_HASH}|sge|endwalker`,
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'SGE Endwalker BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for SGE Endwalker in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

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
    describe("validateEmbed endpoint", () => {
        const fastify = buildStatsServer();
        it('passes BiS with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|${BIS_HASH}|sge|endwalker|anabaseios&onlySetIndex=2`,
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
                url: `/validateEmbed?page=embed|${BIS_HASH}|sge|endwalker|anabaseios`,
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
                url: `/validateEmbed?page=${BIS_HASH}|sge|endwalker|anabaseios&onlySetIndex=2`,
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
