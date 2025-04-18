import {JobName} from "@xivgear/xivmath/xivconstants";

const STATIC_SERVER: URL = new URL("https://staticbis.xivgear.app/");

const STORAGE_KEY = 'staticbis-server-override';

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
    return STATIC_SERVER;
}

export function setServerOverride(server: string) {
    // Validate URL
    new URL(server);
    localStorage.setItem(STORAGE_KEY, server);
}

export function getBisSheetFetchUrl(path: string[]): URL {
    let current: URL = new URL(getServer());
    for (let i = 0; i < path.length - 1; i++) {
        current = new URL(`./${path[i]}/`, current);
    }
    current = new URL(`./${path[path.length - 1]}.json`, current);
    return current;
}

export async function getBisSheet(...params: Parameters<typeof getBisSheetFetchUrl>): Promise<string> {
    const FULL_URL = getBisSheetFetchUrl(...params);
    return await fetch(FULL_URL).then(response => response.text());
}
