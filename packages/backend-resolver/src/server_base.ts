import Fastify from "fastify";
import FastifyIP from "fastify-ip";
import cors from "@fastify/cors";
import process from "process";
import path from "node:path";
import fs from "node:fs";

let initDone = false;

function checkInit() {
    if (!initDone) {
        doInit();
        initDone = true;
    }
}

function doInit() {
    // TODO: what is this doing?
    // registerDefaultSims();
}

function baseFastify() {
    return Fastify({
        logger: true,
        ignoreTrailingSlash: true,
        ignoreDuplicateSlashes: true,
        // querystringParser: str => querystring.parse(str, '&', '=', {}),
    });
}

type FastifyInstance = ReturnType<typeof baseFastify>;

export abstract class ServerBase {

    private readonly fastifyInstance: FastifyInstance;

    constructor() {
        this.fastifyInstance = baseFastify();
    }

    baseSetup(): void {
        checkInit();

        // Get the true IP from CF headers
        this.fastifyInstance.register(FastifyIP, {
            order: ['cf-connecting-ip'],
            strict: true,
        });

        // CORS permissions
        this.fastifyInstance.register(cors, {
            methods: ['GET', 'PUT', 'OPTIONS'],
            strictPreflight: false,
        });

        this.fastifyInstance.get('/healthcheck', {
            schema: {
                tags: ['internal'],
                response: {200: {type: 'string'}},
            },
        }, async (request, reply) => {
            return 'up';
        });

        process.on('uncaughtException', (reason: Error) => {
            this.fastifyInstance.log.error(`uncaught exception: ${reason}`);
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.fastifyInstance.log.error(`unhandled rejection at: ${promise}, reason: ${reason}`);
        });
    }

    abstract setup(fastifyInstance: FastifyInstance): void;

    setupOnly(): void {
        this.baseSetup();
        this.setup(this.fastifyInstance);
    }

    setupForTest(): FastifyInstance {
        this.setupOnly();
        this.fastifyInstance.setErrorHandler((error, request, reply) => {
            console.error(error);
            reply.status(500).send({error: error});
        });
        this.fastifyInstance.setSchemaErrorFormatter((errors, dataVar) => {
            return new Error(errors.map((error) => {
                return `${dataVar} ${error.message}`;
            }).join('\n'));
        });
        this.fastifyInstance.addHook('onResponse', (request, reply, payload) => {
            request.log.debug({payload});
        });
        return this.fastifyInstance;
    }

    setupAndStart(): void {
        this.setupOnly();
        this.fastifyInstance.listen({
            port: 30000,
            host: '0.0.0.0',
        }, (err, addr) => {
            if (err) {
                this.fastifyInstance.log.error(err);
                process.exit(1);
            }
        });
    }

    protected registerSchemas(schemaFiles: string[]) {
        const fastifyInstance = this.fastifyInstance;
        for (const relPath of schemaFiles) {
            const schemaPath = path.resolve(__dirname, relPath);
            if (fs.existsSync(schemaPath)) {
                const raw = fs.readFileSync(schemaPath, {encoding: 'utf-8'});
                const apiSchemas = JSON.parse(raw) as Record<string, unknown> & {
                    definitions?: Record<string, unknown>
                };
                if (apiSchemas.definitions && typeof apiSchemas.definitions === 'object') {
                    for (const [name, schema] of Object.entries(apiSchemas.definitions)) {
                        // Filter out invalid names since they wouldn't be needed anyway.
                        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
                            continue;
                        }
                        // Deep-clean the schema to remove internal $ref that point to local definitions
                        // since Fastify doesn't always handle them well when they are registered individually.
                        const cleanSchema = JSON.parse(JSON.stringify(schema), (key, value) => {
                            if (key === '$ref' && typeof value === 'string' && value.startsWith('#/definitions/')) {
                                const refName = value.replace('#/definitions/', '');
                                // If the referenced name is one we would skip, we must skip this ref or fix it.
                                // For now, only convert refs to names that match our allowed pattern.
                                if (/^[a-zA-Z0-9_-]+$/.test(refName)) {
                                    return refName + '#';
                                }
                                // If it's a problematic name, we remove the ref to prevent Fastify from crashing.
                                // It probably isn't needed anyway.
                                return undefined;
                            }
                            return value;
                        });
                        try {
                            fastifyInstance.addSchema({$id: name, ...cleanSchema});
                        }
                        catch (e) {
                            fastifyInstance.log.debug({
                                err: e,
                                name,
                            }, 'Skipping invalid generated schema');
                        }
                    }
                }
            }
        }

    }

}
