export const XIVAPI_BASE_URL = "https://v2.xivapi.com/api";
export const XIVAPI_BASE_URL_FALLBACK = "https://bm.xivgear.app/api/1";

export async function xivApiFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    return xFetchInternal(params);
}

async function xFetchInternal(params: Parameters<typeof fetch>): Promise<Response> {
    let tries = 5;
    while (true) {
        tries--;
        let result: Response;
        try {
            result = await fetch(...params);
        }
        catch (e) {
            console.warn("Xivapi fetch failed, trying again with fallback URL", params[0], e);
            const fbUrl = new URL(params[0].toString().replace(XIVAPI_BASE_URL, XIVAPI_BASE_URL_FALLBACK));
            const fbParams: typeof params = [...params];
            fbParams[0] = fbUrl;
            result = await fetch(...fbParams);
        }
        // TODO: add other errors here?
        if (tries > 0 && result.status === 429) {
            console.log("xivapi throttle, retrying", params[0]);
            await new Promise(r => setTimeout(r, 500 + (Math.random() * 1000)));
            continue;
        }
        if (result.status >= 400) {
            const content = JSON.stringify(await result.json());
            console.error(`XivApi error: ${result.status}: ${result.statusText}`, params[0], content);
            throw Error(`XivApi error: ${result.status}: ${result.statusText} (${params[0]}\n${content}`);
        }
        return result;
    }
}

export async function xivApiSingleCols<Columns extends readonly string[]>(sheet: string, id: number, cols: Columns, lang?: string): Promise<{
    [K in Columns[number]]: unknown;
} & {
    ID: number
}> {

    const query = new URL(`./sheet/${sheet}/${id}?fields=${cols.join(',')}`, XIVAPI_BASE_URL + '/');
    if (lang) {
        query.searchParams.set('language', lang);
    }
    return xivApiFetch(query).then(response => response.json()).then(response => {
        const responseOut = response['fields'];
        responseOut['ID'] = response['row_id'];
        return responseOut;
    });
}

export function xivApiAsset(assetPath: string, format: 'png' | 'jpg' | 'webp' = 'webp') {
    return `${XIVAPI_BASE_URL}/asset?path=${encodeURIComponent(assetPath)}&format=${format}`;
}

export function xivApiIconUrl(iconId: number, highRes: boolean = false): string {
    // Pad to 6 digits, e.g. 19581 -> '019581'
    const asStr = iconId.toString(10).padStart(6, '0');
    // Get the xivapi directory, e.g. 19581 -> 019000
    const directory = asStr.substring(0, 3) + '000';
    return xivApiAsset(`ui/icon/${directory}/${asStr}${highRes ? '_hr1' : ''}.tex`);
}

export function setXivApiIcon(img: HTMLImageElement, iconId: number, lrIntrinsicSize: [number, number], renderSize: [number, number]) {
    const lr = xivApiIconUrl(iconId, false);
    const hr = xivApiIconUrl(iconId, true);
    img.setAttribute('intrinsicsize', `${lrIntrinsicSize[0]}x${lrIntrinsicSize[1]}`);
    img.src = lr;
    const ratio = Math.min(lrIntrinsicSize[0] / renderSize[0], lrIntrinsicSize[1] / renderSize[1]);
    img.srcset = `${lr} ${ratio}x, ${hr} ${ratio * 2}x`;
}
