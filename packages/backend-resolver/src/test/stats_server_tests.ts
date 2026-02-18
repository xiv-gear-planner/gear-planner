import '../polyfills';
import {expect} from "chai";
import {buildStatsServer, EmbedCheckResponse} from "../server_builder";
import {SheetStatsExport} from "@xivgear/xivmath/geartypes";
import {BIS_HASH} from "@xivgear/core/nav/common_nav";

// TODO: add tests for validateEmbed with direct URL (on a different branch)

describe('stats server', () => {
    describe("fulldata endpoint", () => {
        describe("legacy direct UUID endpoint", () => {
            const fastify = buildStatsServer();
            it("responds to health check", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/healthcheck',
                });
                expect(response.statusCode).to.equal(200);
            });
            it("can serve correct data", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json() as SheetStatsExport;
                expect(json.name).to.equal("WHM 6.4 copy");
                expect(json.level).to.equal(90);
                expect(json.job).to.equal("WHM");
                expect(json.race).to.equal("Xaela");
                expect(json.partyBonus).to.equal(0);
                expect(json.sets.length).to.equal(13);
                const firstSet = json.sets[0];
                expect(firstSet.name).to.equal("6.4 Never gonna");
                expect(firstSet.items.Weapon?.id).to.equal(40173);
                const stats = firstSet.computedStats;
                expect(stats.hp).to.equal(74421);
                expect(stats.mind).to.equal(3374);
            }).timeout(30_000);
            it("can serve correct data with party size 0", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=0',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json() as SheetStatsExport;
                expect(json.name).to.equal("WHM 6.4 copy");
                expect(json.level).to.equal(90);
                expect(json.job).to.equal("WHM");
                expect(json.race).to.equal("Xaela");
                expect(json.partyBonus).to.equal(0);
                expect(json.sets.length).to.equal(13);
                const firstSet = json.sets[0];
                expect(firstSet.name).to.equal("6.4 Never gonna");
                expect(firstSet.items.Weapon?.id).to.equal(40173);
                const stats = firstSet.computedStats;
                expect(stats.hp).to.equal(74421);
                expect(stats.mind).to.equal(3374);
            }).timeout(30_000);
            it("can serve correct data with party size 5", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501?partyBonus=5',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json() as SheetStatsExport;
                expect(json.name).to.equal("WHM 6.4 copy");
                expect(json.level).to.equal(90);
                expect(json.job).to.equal("WHM");
                expect(json.race).to.equal("Xaela");
                expect(json.partyBonus).to.equal(5);
                expect(json.sets.length).to.equal(13);
                const firstSet = json.sets[0];
                expect(firstSet.name).to.equal("6.4 Never gonna");
                expect(firstSet.items.Weapon?.id).to.equal(40173);
                const stats = firstSet.computedStats;
                expect(stats.mind).to.equal(3542);
                expect(stats.hp).to.equal(78455);
            }).timeout(30_000);
            it("fulldata - 404 on missing data", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata',
                });
                expect(response.statusCode).to.equal(404);
            });

            it("importExportSheet - invalid party bonus (too large)", async () => {
                // We need a valid sheet to reach the party bonus check
                const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
                const response = await fastify.inject({
                    method: 'GET',
                    url: `/fulldata/${uuid}?partyBonus=10`, // valid values are [0,5]
                });
                expect(response.statusCode).to.equal(500);
            });

            it("importExportSheet - invalid party bonus 2 (too small)", async () => {
                // We need a valid sheet to reach the party bonus check
                const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
                const response = await fastify.inject({
                    method: 'GET',
                    url: `/fulldata/${uuid}?partyBonus=-10`, // valid values are [0,5]
                });
                expect(response.statusCode).to.equal(500);
            });

            it("importExportSheet - invalid party bonus 3 (not an integer)", async () => {
                // We need a valid sheet to reach the party bonus check
                const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
                const response = await fastify.inject({
                    method: 'GET',
                    url: `/fulldata/${uuid}?partyBonus=3.5`, // must be an integer
                });
                expect(response.statusCode).to.equal(500);
            });

            it("importExportSheet - invalid party bonus 4 (not a number)", async () => {
                // We need a valid sheet to reach the party bonus check
                const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
                const response = await fastify.inject({
                    method: 'GET',
                    url: `/fulldata/${uuid}?partyBonus=asdf`, // must be an integer
                });
                expect(response.statusCode).to.equal(500);
            });

            it("importExportSheet - invalid set index (too large)", async () => {
                const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
                const response = await fastify.inject({
                    method: 'GET',
                    url: `/fulldata/${uuid}?onlySetIndex=999`,
                });
                expect(response.statusCode).to.equal(500);
            });

            it("importExportSheet - invalid set index (not a number)", async () => {
                const uuid = 'f9b260a9-650c-445a-b3eb-c56d8d968501';
                const response = await fastify.inject({
                    method: 'GET',
                    url: `/fulldata/${uuid}?onlySetIndex=asdf`,
                });
                expect(response.statusCode).to.equal(500);
            });
        });
        describe("legacy bis endpoints", () => {
            it("deprecated /fulldata/bis/:job/:sheet", async () => {
                const fastify = buildStatsServer();
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata/bis/war/prog',
                });
                expect(response.statusCode).to.equal(200);
                // Since this might change, not worth verifying that much
                const json = response.json();
                expect(json.name).to.contain("Prog BiS");
                expect(json.sets[0].computedStats.hp).to.be.greaterThan(0);
            });

            it("deprecated fulldata/bis/:job/:folder/:sheet", async () => {
                const fastify = buildStatsServer();
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata/bis/war/archive/7.2-prog',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json();
                expect(json.name).to.equal("7.2 WAR Prog BiS");
                expect(json.sets[0].computedStats.hp).to.be.greaterThan(0);
            });

        });
        describe("modern unified endpoint", () => {
            const fastify = buildStatsServer();

            it("can serve correct data", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json() as SheetStatsExport;
                expect(json.name).to.equal("WHM 6.4 copy");
                expect(json.level).to.equal(90);
                expect(json.job).to.equal("WHM");
                expect(json.race).to.equal("Xaela");
                expect(json.partyBonus).to.equal(0);
                expect(json.sets.length).to.equal(13);
                const firstSet = json.sets[0];
                expect(firstSet.name).to.equal("6.4 Never gonna");
                expect(firstSet.items.Weapon?.id).to.equal(40173);
                const stats = firstSet.computedStats;
                expect(stats.hp).to.equal(74421);
                expect(stats.mind).to.equal(3374);
            }).timeout(30_000);
            it("can serve correct data with party size 0", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501&partyBonus=0',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json() as SheetStatsExport;
                expect(json.name).to.equal("WHM 6.4 copy");
                expect(json.level).to.equal(90);
                expect(json.job).to.equal("WHM");
                expect(json.race).to.equal("Xaela");
                expect(json.partyBonus).to.equal(0);
                expect(json.sets.length).to.equal(13);
                const firstSet = json.sets[0];
                expect(firstSet.name).to.equal("6.4 Never gonna");
                expect(firstSet.items.Weapon?.id).to.equal(40173);
                const stats = firstSet.computedStats;
                expect(stats.hp).to.equal(74421);
                expect(stats.mind).to.equal(3374);
            }).timeout(30_000);
            it("can serve correct data with party size 5", async () => {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/fulldata?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501&partyBonus=5',
                });
                expect(response.statusCode).to.equal(200);
                const json = response.json() as SheetStatsExport;
                expect(json.name).to.equal("WHM 6.4 copy");
                expect(json.level).to.equal(90);
                expect(json.job).to.equal("WHM");
                expect(json.race).to.equal("Xaela");
                expect(json.partyBonus).to.equal(5);
                expect(json.sets.length).to.equal(13);
                const firstSet = json.sets[0];
                expect(firstSet.name).to.equal("6.4 Never gonna");
                expect(firstSet.items.Weapon?.id).to.equal(40173);
                const stats = firstSet.computedStats;
                expect(stats.mind).to.equal(3542);
                expect(stats.hp).to.equal(78455);
            }).timeout(30_000);

        });
    });

    describe('/basedata endpoint', () => {
        const fastify = buildStatsServer();
        it("404 on missing data", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/basedata',
            });
            expect(response.statusCode).to.equal(404);
        });

    });

    describe("validateEmbed endpoint", () => {
        const fastify = buildStatsServer();
        it('passes BiS with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|${BIS_HASH}|sge|archive|anabaseios&onlySetIndex=2`,
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json() as EmbedCheckResponse;
            expect(json).to.deep.equal({
                isValid: true,
            } satisfies EmbedCheckResponse);
        });
        it('rejects BiS without onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|${BIS_HASH}|sge|archive|anabaseios`,
            });
            const json = response.json() as EmbedCheckResponse;
            expect(json).to.deep.equal({
                isValid: false,
                reason: 'full sheets cannot be embedded',
            } satisfies EmbedCheckResponse);
        });
        it('rejects BiS without embed', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=${BIS_HASH}|sge|archive|anabaseios&onlySetIndex=2`,
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json() as EmbedCheckResponse;
            expect(json).to.deep.equal({
                isValid: false,
                reason: 'not an embed',
            } satisfies EmbedCheckResponse);
        });
        it('passes full-sheet shortlink with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|sl|14433fae-67c1-4727-b772-54a07914fc03&onlySetIndex=2`,
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json() as EmbedCheckResponse;
            expect(json).to.deep.equal({
                isValid: true,
            } satisfies EmbedCheckResponse);
        });
        it('rejects full-sheet shortlink without onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|sl|14433fae-67c1-4727-b772-54a07914fc03`,
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json() as EmbedCheckResponse;
            expect(json).to.deep.equal({
                isValid: false,
                reason: 'full sheets cannot be embedded',
            } satisfies EmbedCheckResponse);
        });
        it('passes single-set shortlink with onlySetIndex', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/validateEmbed?page=embed|sl|0cd5874c-6322-4396-99be-2089d6222d9c`,
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json() as EmbedCheckResponse;
            expect(json).to.deep.equal({
                isValid: true,
            } satisfies EmbedCheckResponse);
        });
        it("missing path", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/validateEmbed',
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json();
            expect(json.isValid).to.be.false;
            expect(json.reason).to.include("not found");
        });

        it("invalid path", async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/validateEmbed?page=nonsense|path',
            });
            expect(response.statusCode).to.equal(200);
            const json = response.json();
            expect(json.isValid).to.be.false;
        });
    });

});
