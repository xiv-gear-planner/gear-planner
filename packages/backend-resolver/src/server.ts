import * as process from "process";
import {buildServerInstance} from "./server_builder";

const fastify = buildServerInstance();

fastify.listen({
    port: 30000,
    host: '0.0.0.0'
}, (err, addr) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});