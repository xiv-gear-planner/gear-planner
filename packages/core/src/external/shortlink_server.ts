import {EMBED_HASH, makeUrl, NavState, SHORTLINK_HASH} from "../nav/common_nav";

const DEFAULT_SHORTLINK_SERVER: URL = new URL("https://api.xivgear.app/shortlink/");

/**
 * Provides the service of retrieving and putting shortlinks
 */
export interface ShortlinkService {
    getShortlinkFetchUrl(stub: string): URL;

    getShortLink(uuid: string): Promise<string>;

    putShortLink(content: string, embed?: boolean): Promise<URL>
}


export class ShortlinkServiceImpl implements ShortlinkService {

    constructor(serverOverride?: URL | null | undefined | string) {
        this.server = (serverOverride || DEFAULT_SHORTLINK_SERVER).toString();
    }

    private server;

    getShortlinkFetchUrl(stub: string): URL {
        return new URL(encodeURIComponent(stub), this.server);
    }

    async getShortLink(uuid: string): Promise<string> {
        const FULL_URL = this.getShortlinkFetchUrl(uuid);
        return await fetch(FULL_URL).then(response => response.text());
    }

    async putShortLink(content: string, embed?: boolean): Promise<URL> {
        return await fetch(this.server, {
            method: "POST",
            body: content,
        }).then(response => response.text()).then(uuid => {
            // If on prod, use the fancy share link.
            if (embed) {
                return makeUrl(new NavState([EMBED_HASH, SHORTLINK_HASH, uuid]));
            }
            else {
                return makeUrl(new NavState([SHORTLINK_HASH, uuid]));
            }
        });
    }
}

export class MockShortlinkService implements ShortlinkService {
    private readonly entries = new Map<string, string>();

    constructor(private readonly baseUrl: string) {
    }

    addShortlink(uuid: string, content: string) {
        this.entries.set(uuid, content);
    }

    getShortlinkFetchUrl(stub: string): URL {
        return new URL(`${this.baseUrl}/${encodeURIComponent(stub)}`);
    }

    async getShortLink(uuid: string): Promise<string> {
        const content = this.entries.get(uuid);
        if (content === undefined) {
            throw new Error(`Shortlink not found: ${uuid}`);
        }
        return content;
    }

    async putShortLink(content: string, embed?: boolean): Promise<URL> {
        const uuid = crypto.randomUUID();
        this.entries.set(uuid, content);
        if (embed) {
            return makeUrl(new NavState([EMBED_HASH, SHORTLINK_HASH, uuid]));
        }
        else {
            return makeUrl(new NavState([SHORTLINK_HASH, uuid]));
        }
    }
}
