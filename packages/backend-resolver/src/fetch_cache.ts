// @ts-expect-error no type defs available for this library
import NodeFetchCache, {MemoryCache} from 'node-fetch-cache';

const cache = new MemoryCache({
    // 1 hour
    ttl: 60 * 60 * 1000,
});

const cachedFetch = NodeFetchCache.create({
    shouldCacheResponse: (response: Response) => response.ok && !response.url?.includes("_cacheBust"),
    cache: cache,
});

export function installFetchCache() {
// @ts-expect-error no type defs available for this library
    global.fetch = (input: Request | string | URL, init: RequestInit) => {
        return cachedFetch((input instanceof URL) ? input.toString() : input, init);
    };
}

export const nonCachedFetch = NodeFetchCache.create({
    shouldCacheResponse: () => false,
});
