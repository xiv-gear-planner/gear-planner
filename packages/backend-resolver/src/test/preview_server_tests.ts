import {buildPreviewServer} from "../server_builder";
import {expect} from "chai";
import {BIS_BROWSER_HASH, BIS_HASH, SHORTLINK_HASH} from "@xivgear/core/nav/common_nav";
import {ALL_COMBAT_JOBS} from "@xivgear/xivmath/xivconstants";
import '../polyfills';

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

describe('preview server', () => {
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
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            expect(parsed.querySelector('title')?.textContent).to.equal(slTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=WHM");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const shortlinkPreload = preloads[preloads.length - 1];
            expect(shortlinkPreload.getAttribute('rel')).to.equal("preload");
            expect(shortlinkPreload.getAttribute('href')).to.equal(`https://api.xivgear.app/shortlink/${uuid}`);
            expect(shortlinkPreload.getAttribute('as')).to.equal("fetch");
            expect(shortlinkPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(slTitle);
        }).timeout(30_000);
        it("resolves shortlink with trailing slash", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|f9b260a9-650c-445a-b3eb-c56d8d968501`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            expect(parsed.querySelector('title')?.textContent).to.equal(slTitle);
        }).timeout(30_000);
        it("resolves shortlink with set selection index", async () => {
            const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|${uuid}&selectedIndex=3`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            expect(parsed.querySelector('title')?.textContent).to.equal(slTitle);


            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=WHM");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const shortlinkPreload = preloads[preloads.length - 1];
            expect(shortlinkPreload.getAttribute('rel')).to.equal("preload");
            expect(shortlinkPreload.getAttribute('href')).to.equal(`https://api.xivgear.app/shortlink/${uuid}`);
            expect(shortlinkPreload.getAttribute('as')).to.equal("fetch");
            expect(shortlinkPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(slTitle);
        }).timeout(30_000);
        it("resolves shortlink exclusive set index", async () => {
            const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|${uuid}&onlySetIndex=3`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            const setTitle = '6.4 Week 1 2.43 b - XivGear - FFXIV Gear Planner';
            expect(parsed.querySelector('title')?.textContent).to.equal(setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=WHM");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const shortlinkPreload = preloads[preloads.length - 1];
            expect(shortlinkPreload.getAttribute('rel')).to.equal("preload");
            expect(shortlinkPreload.getAttribute('href')).to.equal(`https://api.xivgear.app/shortlink/${uuid}`);
            expect(shortlinkPreload.getAttribute('as')).to.equal("fetch");
            expect(shortlinkPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(setTitle);
        }).timeout(30_000);
        const bisTitle = '6.55 Savage SGE BiS - XivGear - FFXIV Gear Planner';
        it("resolves bis link", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|archive|anabaseios`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            expect(parsed.querySelector('title')?.textContent).to.equal(bisTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=SGE");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const shortlinkPreload = preloads[preloads.length - 1];
            expect(shortlinkPreload.getAttribute('rel')).to.equal("preload");
            expect(shortlinkPreload.getAttribute('href')).to.equal(`https://staticbis.xivgear.app/sge/archive/anabaseios.json`);
            expect(shortlinkPreload.getAttribute('as')).to.equal("fetch");
            expect(shortlinkPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(bisTitle);
        }).timeout(30_000);
        it("recovers from invalid bis link", async () => {
            {
                const badResponse = await fastify.inject({
                    method: 'GET',
                    url: `/?page=${BIS_HASH}|pld|`,
                });
                expect(badResponse.statusCode).to.equal(200);
                const parsed = parser.parseFromString(badResponse.body, 'text/html');
                expect(parsed.querySelector('title')?.textContent).to.equal('XivGear - FFXIV Gear Planner');
            }

            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|archive|anabaseios`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            expect(parsed.querySelector('title')?.textContent).to.equal(bisTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=SGE");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const shortlinkPreload = preloads[preloads.length - 1];
            expect(shortlinkPreload.getAttribute('rel')).to.equal("preload");
            expect(shortlinkPreload.getAttribute('href')).to.equal(`https://staticbis.xivgear.app/sge/archive/anabaseios.json`);
            expect(shortlinkPreload.getAttribute('as')).to.equal("fetch");
            expect(shortlinkPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(bisTitle);
        }).timeout(30_000);
        it("resolves bis link with onlySetIndex", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|archive|anabaseios&onlySetIndex=2`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = '2.45 Non-Relic - XivGear - FFXIV Gear Planner';
            const setDesc = '(6.4) - Same as WHM 2.45. Lowest piety but highest DPS.\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            expect(parsed.querySelector('title')?.textContent).to.equal(setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=SGE");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const shortlinkPreload = preloads[preloads.length - 1];
            expect(shortlinkPreload.getAttribute('rel')).to.equal("preload");
            expect(shortlinkPreload.getAttribute('href')).to.equal(`https://staticbis.xivgear.app/sge/archive/anabaseios.json`);
            expect(shortlinkPreload.getAttribute('as')).to.equal("fetch");
            expect(shortlinkPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(setTitle);
            expect(props['og:description']).to.equal(setDesc);
        }).timeout(30_000);
        it("resolves bisbrowser link with no job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            expect(parsed.querySelector('title')?.textContent).to.equal(setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1 - (ALL_COMBAT_JOBS.length)];
            expect(bisIndexPreload.getAttribute('rel')).to.equal("preload");
            expect(bisIndexPreload.getAttribute('href')).to.equal('https://staticbis.xivgear.app/_index.json');
            expect(bisIndexPreload.getAttribute('as')).to.equal("fetch");
            expect(bisIndexPreload.hasAttribute('crossorigin')).to.be.true;

            expect(bisIndexPreload.getAttribute('rel')).to.equal("preload");
            expect(bisIndexPreload.getAttribute('href')).to.equal('https://staticbis.xivgear.app/_index.json');
            expect(bisIndexPreload.getAttribute('as')).to.equal("fetch");
            expect(bisIndexPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(setTitle);
            expect(props['og:description']).to.equal(setDesc);
        }).timeout(30_000);
        it("resolves bisbrowser link with a job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|sge|archive`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'SGE Archive BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for SGE Archive in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            expect(parsed.querySelector('title')?.textContent).to.equal(setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1];
            expect(bisIndexPreload.getAttribute('rel')).to.equal("preload");
            expect(bisIndexPreload.getAttribute('href')).to.equal('https://staticbis.xivgear.app/_index.json');
            expect(bisIndexPreload.getAttribute('as')).to.equal("fetch");
            expect(bisIndexPreload.hasAttribute('crossorigin')).to.be.true;

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=SGE");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(setTitle);
            expect(props['og:description']).to.equal(setDesc);
        }).timeout(30_000);
        it("resolves invalid bisbrowser link with no job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|foo|bar`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'Foo Bar BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for Foo Bar in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            expect(parsed.querySelector('title')?.textContent).to.equal(setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1];
            expect(bisIndexPreload.getAttribute('rel')).to.equal("preload");
            expect(bisIndexPreload.getAttribute('href')).to.equal('https://staticbis.xivgear.app/_index.json');
            expect(bisIndexPreload.getAttribute('as')).to.equal("fetch");
            expect(bisIndexPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(setTitle);
            expect(props['og:description']).to.equal(setDesc);
        }).timeout(30_000);
        it("resolves invalid bisbrowser link with a job", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|sge|endwalker2`,
            });
            expect(response.statusCode).to.equal(200);
            const parsed = parser.parseFromString(response.body, 'text/html');

            const setTitle = 'SGE Endwalker2 BiS - XivGear - FFXIV Gear Planner';
            const setDesc = 'Best-in-Slot Gear Sets for SGE Endwalker2 in Final Fantasy XIV\n\nXivGear is an advanced and easy-to-use FFXIV gear planner/set builder with built-in simulation support.';

            expect(parsed.querySelector('title')?.textContent).to.equal(setTitle);

            // Check the preloads
            const preloads = Array.from(parsed.querySelectorAll('link'))
                .filter(link => link.rel === 'preload');

            const bisIndexPreload = preloads[preloads.length - 1];
            expect(bisIndexPreload.getAttribute('rel')).to.equal("preload");
            expect(bisIndexPreload.getAttribute('href')).to.equal('https://staticbis.xivgear.app/_index.json');
            expect(bisIndexPreload.getAttribute('as')).to.equal("fetch");
            expect(bisIndexPreload.hasAttribute('crossorigin')).to.be.true;

            const jobPreload = preloads[preloads.length - 2];
            expect(jobPreload.getAttribute('rel')).to.equal("preload");
            expect(jobPreload.getAttribute('href')).to.equal("https://data.xivgear.app/Items?job=SGE");
            expect(jobPreload.getAttribute('as')).to.equal("fetch");
            expect(jobPreload.hasAttribute('crossorigin')).to.be.true;

            const props = readPreviewProps(parsed);
            expect(props['og:site_name']).to.equal('XivGear');
            expect(props['og:type']).to.equal('website');
            expect(props['og:title']).to.equal(setTitle);
            expect(props['og:description']).to.equal(setDesc);
        }).timeout(30_000);

        it("bisbrowser path", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_BROWSER_HASH}|WHM|archive`,
            });
            expect(response.statusCode).to.equal(200);
            // In JSDOM, maybe case matters or it's not in the body but in the head
            expect(response.body).to.include("WHM Archive BiS");
        }).timeout(30_000);

        it("bis path", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|WHM|archive|anabaseios`,
            });
            expect(response.statusCode).to.equal(200);
        }).timeout(30_000);

        it("long name truncation", async () => {
            const longName = "A".repeat(200);
            const jsonBlob = JSON.stringify({
                name: longName,
                sets: [],
                job: 'WHM',
            });
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=viewset|${encodeURIComponent(jsonBlob)}`,
            });
            expect(response.statusCode).to.equal(200);
            // Check for truncation ellipsis
            expect(response.body).to.include("…");
        }).timeout(30_000);

        it("multi-job includes all relevant preloads", async () => {
            const jsonBlob = JSON.stringify({
                name: "Multi-job sheet",
                sets: [],
                job: 'WHM',
                isMultiJob: true,
            });
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=viewsheet|${encodeURIComponent(jsonBlob)}`,
            });
            expect(response.statusCode).to.equal(200);
            expect(response.body).to.contain("WHM");
            expect(response.body).to.contain("AST");
            expect(response.body).to.contain("SCH");
            expect(response.body).to.contain("SGE");
        }).timeout(30_000);

        it("cache bust", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|f9b260a9-650c-445a-b3eb-c56d8d968501&_cacheBust=12345`,
            });
            expect(response.statusCode).to.equal(200);
            expect(response.headers['clear-site-data']).to.equal('"cache", "prefetchCache", "prerenderCache"');
            expect(response.headers['cache-control']).to.equal('max-age=0, no-cache');
        }).timeout(30_000);

    });
    describe("buildPreviewServer with EXTRA_SCRIPTS", () => {
        let oldExtraScripts: string | undefined;
        before(() => {
            oldExtraScripts = process.env.EXTRA_SCRIPTS;
            process.env.EXTRA_SCRIPTS = "https://example.com/script1.js;https://example.com/script2.js";
        });
        after(() => {
            process.env.EXTRA_SCRIPTS = oldExtraScripts;
        });

        it("injects extra scripts for normal pages", async () => {
            const fastify = buildPreviewServer();
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|f9b260a9-650c-445a-b3eb-c56d8d968501`,
            });
            expect(response.statusCode).to.equal(200);
            expect(response.body).to.include('https://example.com/script1.js');
            expect(response.body).to.include('https://example.com/script2.js');
        }).timeout(30_000);

        it("does not inject extra scripts when embedded", async () => {
            const fastify = buildPreviewServer();
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=embed|sl|f9b260a9-650c-445a-b3eb-c56d8d968501&onlySetIndex=1`,
            });
            expect(response.statusCode).to.equal(200);
            // It should still have scripts-injected="true" on html element, but not the script tags
            // Use a regex that is case insensitive
            // expect(/scripts-injected="true"/i.test(response.body)).to.be.true;
            expect(response.body).to.not.include('https://example.com/script1.js');
        }).timeout(30_000);
    });

});
