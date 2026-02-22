import {EMBED_HASH, makeUrl, NavState, SHORTLINK_HASH} from "../nav/common_nav";

const DEFAULT_SHORTLINK_SERVER: URL = new URL("https://api.xivgear.app/shortlink/");


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

    setServerOverride(serverOverride: string) {
        // Validate URL
        new URL(serverOverride);
        this.server = serverOverride;
    }
}

export const DEFAULT_SHORTLINK_PROVIDER = new ShortlinkServiceImpl();
