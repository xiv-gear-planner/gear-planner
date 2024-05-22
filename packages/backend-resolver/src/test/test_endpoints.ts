import '../polyfills';
import assert from "assert";
import {buildServerInstance} from "../server_builder";
import {SheetStatsExport} from "@xivgear/xivmath/geartypes";

describe("backend stat resolver server", () => {
    it("responds to health check", async () => {
        const fastify = buildServerInstance();
        const response = await fastify.inject({
            method: 'GET',
            url: '/healthcheck'
        });
        assert.equal(response.statusCode, 200);
    });
    it("can serve correct data", async () => {
        const fastify = buildServerInstance();
        const response = await fastify.inject({
            method: 'GET',
            url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501'
        });
        const json = response.json() as SheetStatsExport;
        assert.equal(response.statusCode, 200);
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
        const fastify = buildServerInstance();
        const response = await fastify.inject({
            method: 'GET',
            url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=0'
        });
        const json = response.json() as SheetStatsExport;
        assert.equal(response.statusCode, 200);
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
        const fastify = buildServerInstance();
        const response = await fastify.inject({
            method: 'GET',
            url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=5'
        });
        const json = response.json() as SheetStatsExport;
        assert.equal(response.statusCode, 200);
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
