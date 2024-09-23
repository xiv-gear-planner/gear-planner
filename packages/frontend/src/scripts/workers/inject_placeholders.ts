const proc = {
    env: {
        NODE_DEBUG: false
    },
    version: "20.0.1"
};

// @ts-expect-error - process is not available in a browser context
global.process = proc;