import '../polyfills';
import assert from "assert";
import {buildPreviewServer, buildStatsServer} from "../server_builder";
import {SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {BIS_HASH, SHORTLINK_HASH} from "@xivgear/core/nav/common_nav";

describe("backend stat resolver server", () => {
    describe("set fulldata endpoint", () => {
        const fastify = buildStatsServer();
        it("responds to health check", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/healthcheck'
            });
            assert.equal(response.statusCode, 200);
        });
        it("can serve correct data", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501'
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
            assert.equal(firstSet.items.Weapon.id, 40173);
            const stats = firstSet.computedStats;
            assert.equal(stats.hp, 74421);
            assert.equal(stats.mind, 3374);
        }).timeout(30_000);
        it("can serve correct data with party size 0", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=0'
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
            assert.equal(firstSet.items.Weapon.id, 40173);
            const stats = firstSet.computedStats;
            assert.equal(stats.hp, 74421);
            assert.equal(stats.mind, 3374);
        }).timeout(30_000);
        it("can serve correct data with party size 5", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=5'
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
            assert.equal(firstSet.items.Weapon.id, 40173);
            const stats = firstSet.computedStats;
            assert.equal(stats.mind, 3542);
            assert.equal(stats.hp, 78455);
        }).timeout(30_000);
    });
    describe("preview endpoint", () => {
        const fastify = buildPreviewServer();
        const parser = new DOMParser();
        it("resolves shortlink", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|f9b260a9-650c-445a-b3eb-c56d8d968501`
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title').textContent, 'WHM 6.4 copy - XivGear - FFXIV Gear Planner');
            // Check the preload
            // TODO: last-child is kind of messy
            const jobPreload = parsed.querySelector('link:last-child');
            assert.equal(jobPreload.getAttribute('rel'), "preload");
            assert.equal(jobPreload.getAttribute('href'), "https://data.xivgear.app/Items?job=WHM");
            assert.equal(jobPreload.getAttribute('as'), "fetch");
        }).timeout(30_000);
        it("resolves shortlink with trailing slash", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${SHORTLINK_HASH}|f9b260a9-650c-445a-b3eb-c56d8d968501`
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title').textContent, 'WHM 6.4 copy - XivGear - FFXIV Gear Planner');
        }).timeout(30_000);
        it("resolves bis link", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|endwalker|anabaseios`
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title').textContent, '6.55 Savage SGE BiS - XivGear - FFXIV Gear Planner');
        }).timeout(30_000);
        it("resolves bis link with trailing slash", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/?page=${BIS_HASH}|sge|endwalker|anabaseios`
            });
            assert.equal(response.statusCode, 200);
            const parsed = parser.parseFromString(response.body, 'text/html');
            assert.equal(parsed.querySelector('title').textContent, '6.55 Savage SGE BiS - XivGear - FFXIV Gear Planner');
        }).timeout(30_000);
    });
});
