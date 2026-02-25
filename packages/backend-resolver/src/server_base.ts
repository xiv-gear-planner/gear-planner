import Fastify from "fastify";
import FastifyIP from "fastify-ip";
import cors from "@fastify/cors";
import process from "process";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fs from "node:fs";
import path from "node:path";

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
                response: { 200: { type: 'string' } },
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
}
