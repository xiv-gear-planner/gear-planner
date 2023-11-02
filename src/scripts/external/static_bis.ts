import {JobName} from "../xivconstants";

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

export async function getBisSheet(job: JobName, expac: string, sheetFileName: string): Promise<string> {
    const FULL_URL = new URL(`/${encodeURIComponent(job)}/${encodeURIComponent(expac)}/${encodeURIComponent(sheetFileName)}.json`, getServer());
    return await fetch(FULL_URL).then(response => response.text());
}
