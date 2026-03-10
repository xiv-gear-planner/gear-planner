import '../polyfills';
import {expect} from "chai";
import {makeStatsServer} from "./test_utils";
import {isRecord} from "../server_utils";

describe("Swagger UI Live Schema Tests", () => {

    const fastify = makeStatsServer().setupForTest();

    it("GET /swagger-ui/json returns valid OpenAPI spec with expected paths", async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/swagger-ui/json',
        });
        expect(response.statusCode).to.equal(200);
        const json = response.json();

        // Basic OpenAPI structure
        expect(json.openapi).to.match(/^3\./);
        expect(json.info.title).to.equal('Gearplan API');

        // Check for expected paths
        const paths = json.paths;
        expect(paths).to.have.property('/validateEmbed');
        expect(paths).to.have.property('/basedata');
        expect(paths).to.have.property('/fulldata');
        expect(paths).to.have.property('/putset');
        expect(paths).to.have.property('/putsheet');

        // Check for specific methods
        expect(paths['/validateEmbed']).to.have.property('get');
        expect(paths['/basedata']).to.have.property('get');
        expect(paths['/fulldata']).to.have.property('get');
        expect(paths['/putset']).to.have.property('put');
        expect(paths['/putsheet']).to.have.property('put');
    }).timeout(30_000);

    it("GET /swagger-ui/json contains expected component schemas", async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/swagger-ui/json',
        });
        expect(response.statusCode).to.equal(200);
        const json = response.json();

        const schemas = json.components.schemas;
        const schemaValues = Object.values(schemas);

        const hasSchemaWithDescription = (desc: string) =>
            schemaValues.some((s: unknown) => {
                if (isRecord(s)) {
                    if (s.description === desc) {
                        return true;
                    }
                    if (isRecord(s.properties)) {
                        return Object.values(s.properties).some((p: unknown) => isRecord(p) && p.description === desc);
                    }
                }
                return false;
            });

        // Core response schemas (checking by descriptions or unique properties)
        expect(hasSchemaWithDescription('The direct URL to this set')).to.be.true; // PutSetResponse
        expect(hasSchemaWithDescription('The direct URL to the overall sheet.')).to.be.true; // PutSheetResponse

        // Check for specific structures
        const hasEmbedCheck = schemaValues.some((s: unknown) => {
            if (isRecord(s)) {
                if (Array.isArray(s.anyOf) && s.anyOf.some((a: unknown) => isRecord(a) && isRecord(a.properties) && a.properties.isValid)) {
                    return true;
                }
                if (isRecord(s.properties) && s.properties.isValid) {
                    return true;
                }
            }
            return false;
        });
        expect(hasEmbedCheck).to.be.true;
    }).timeout(30_000);

    it("GET /fulldata schema has a valid response reference", async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/swagger-ui/json',
        });
        const json = response.json();
        const fulldataGet = json.paths['/fulldata'].get;
        const ref = fulldataGet.responses['200'].content['application/json'].schema.$ref;
        expect(ref).to.match(/^#\/components\/schemas\/def-\d+$/);
    });

    it("PUT /putset and /putsheet have valid requestBody references", async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/swagger-ui/json',
        });
        const json = response.json();

        const putset = json.paths['/putset'].put;
        expect(putset.requestBody.content['application/json'].schema.$ref).to.match(/^#\/components\/schemas\/def-\d+$/);

        const putsheet = json.paths['/putsheet'].put;
        expect(putsheet.requestBody.content['application/json'].schema.$ref).to.match(/^#\/components\/schemas\/def-\d+$/);
    });
});
