import {EMBED_HASH, makeUrl, NavState, SHORTLINK_HASH} from "../nav/common_nav";

const SHORTLINK_SERVER: URL = new URL("https://api.xivgear.app/shortlink/");

const STORAGE_KEY = 'shortlink-server-override';

function getServer() {
    const override = localStorage.getItem(STORAGE_KEY);
    if (override) {
        try {
            return new URL(override);
        }
        catch (e) {
            console.error('Invalid override URL, using default', override);
        }
    }
    return SHORTLINK_SERVER;
}

export function setServerOverride(server: string) {
    // Validate URL
    new URL(server);
    localStorage.setItem(STORAGE_KEY, server);
}

export function getShortlinkFetchUrl(stub: string): URL {
    return new URL(encodeURIComponent(stub), getServer());
}

export async function getShortLink(stub: string): Promise<string> {
    const FULL_URL = getShortlinkFetchUrl(stub);
    return await fetch(FULL_URL).then(response => response.text());
}

export async function putShortLink(content: string, embed: boolean = false): Promise<URL> {
    return await fetch(getServer(), {
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
