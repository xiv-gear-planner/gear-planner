// @ts-expect-error no type defs available for this library
import NodeFetchCache, {MemoryCache} from 'node-fetch-cache';


const cachedFetch = NodeFetchCache.create({
    shouldCacheResponse: (response: Response) => response.ok && !response.url?.includes("_cacheBust"),
    cache: new MemoryCache({
        // 12 hours
        ttl: 12 * 60 * 60 * 1000,
    }),
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
