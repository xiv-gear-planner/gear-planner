export const XIVAPI_BASE_URL = "https://v2.xivapi.com/api";

// export type ValidRequest<RequestType extends XivApiRequest> = RequestType['requestType'] extends 'search' ? XivApiSearchRequest : XivApiListRequest;

// export async function xivApiGet<RequestType extends (XivApiListRequest | XivApiSearchRequest)>(request: RequestType | ValidRequest<RequestType>):

export async function xivApiFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    return xFetchInternal(...params);
}

async function xFetchInternal(...params: Parameters<typeof fetch>): Promise<Response> {
    let tries = 5;
    while (true) {
        tries--;
        const result = await fetch(...params);
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

export function xivApiIconUrl(iconId: number, highRes: boolean = false): string {
    // Pad to 6 digits, e.g. 19581 -> '019581'
    const asStr = iconId.toString(10).padStart(6, '0');
    // Get the xivapi directory, e.g. 19581 -> 019000
    const directory = asStr.substring(0, 3) + '000';
    if (highRes) {
        return `${XIVAPI_BASE_URL}/asset/ui/icon/${directory}/${asStr}_hr1.tex?format=png`;
    }
    else {
        return `${XIVAPI_BASE_URL}/asset/ui/icon/${directory}/${asStr}.tex?format=png`;
    }
}
