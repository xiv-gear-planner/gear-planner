import * as process from "process";
import {buildServerInstance} from "./server_builder";
import {setServerOverride} from "@xivgear/core/external/shortlink_server";

const fastify = buildServerInstance();

const backendOverride = process.env.SHORTLINK_SERVER;
if (backendOverride) {
    console.log(`Shortlink server override: '${backendOverride}'`);
    setServerOverride(backendOverride);
}

fastify.listen({
    port: 30000,
    host: '0.0.0.0'
}, (err, addr) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});