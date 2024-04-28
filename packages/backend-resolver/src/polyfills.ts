
import {NodeFetchCache} from 'node-fetch-cache';

const cachedFetch = NodeFetchCache.create({
    shouldCacheResponse: (response: Response) => response.ok,
});
global.fetch = (input: Request | string | URL, init: RequestInit) => {
    return cachedFetch((input instanceof URL) ? input.toString() : input, init);
};


// Hack for JSDom not having ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {
        // do nothing
    }

    unobserve() {
        // do nothing
    }

    disconnect() {
        // do nothing
    }
};
