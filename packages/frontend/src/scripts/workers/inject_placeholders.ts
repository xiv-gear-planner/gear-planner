const proc = {
    env: {
        NODE_DEBUG: false
    }
};

// @ts-expect-error - process is not available in a browser context
global.process = proc;