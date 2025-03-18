// @ts-expect-error no type defs available for this library
import NodeFetchCache from 'node-fetch-cache';


const cachedFetch = NodeFetchCache.create({
    shouldCacheResponse: (response: Response) => response.ok,
});

// @ts-expect-error no type defs available for this library
global.fetch = (input: Request | string | URL, init: RequestInit) => {
    return cachedFetch((input instanceof URL) ? input.toString() : input, init);
};

export const nonCachedFetch = NodeFetchCache.create({
    shouldCacheResponse: () => false,
});

// Hack for JSDom not having ResizeObserver
// TODO: still needed?
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
