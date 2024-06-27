export function xivApiIcon(iconStub: string) {
    return new URL("https://xivapi.com/" + iconStub);
}

export type XivApiRequest = {
    requestType: 'list' | 'search',
    sheet: string,
    columns?: readonly string[],
    pageLimit?: number
}

export type XivApiListRequest = XivApiRequest & {
    requestType: 'list',
}

export type XivApiSearchRequest = XivApiRequest & {
    requestType: 'search',
    filters?: string[],
}

export type XivApiResponse<RequestType extends XivApiRequest> = {
    Results: {
        [K in RequestType['columns'][number]]: unknown;
    }[]
}

// export type ValidRequest<RequestType extends XivApiRequest> = RequestType['requestType'] extends 'search' ? XivApiSearchRequest : XivApiListRequest;

// export async function xivApiGet<RequestType extends (XivApiListRequest | XivApiSearchRequest)>(request: RequestType | ValidRequest<RequestType>):

export async function xivApiFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    return xFetchInternal(...params);
}

async function xFetchInternal(...params: Parameters<typeof fetch>): Promise<Response> {
    let tries = 5;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        tries--;
        const result = await fetch(...params);
        // TODO: add other errors here?
        if (tries > 0 && result.status === 429) {
            console.log("xivapi throttle, retrying", params[0]);
            await new Promise(r => setTimeout(r, 500 + (Math.random() * 1000)));
            continue;
        }
        return result;
    }
}

export async function xivApiSingle(sheet: string, id: number) {
    const query = `https://beta.xivapi.com/api/1/sheet/${sheet}/${id}?version=6.58x2`;
    return xivApiFetch(query).then(response => response.json()).then(response => response['fields']);
}

export async function xivApiSingleCols<Columns extends readonly string[]>(sheet: string, id: number, cols: Columns): Promise<{
    [K in Columns[number]]: unknown;
}> {
    const query = `https://beta.xivapi.com/api/1/sheet/${sheet}/${id}?fields=${cols.join(',')}&version=6.58x2`;
    return xivApiFetch(query).then(response => response.json()).then(response => response['fields']);
}

export async function xivApiGet<RequestType extends (XivApiListRequest | XivApiSearchRequest)>(request: RequestType):
    Promise<XivApiResponse<RequestType>> {
    let query: string;
    if (request.requestType === 'list') {
        return xivApiGetList(request) as Promise<XivApiResponse<RequestType>>;
    }
    else {
        query = `https://xivapi.com/search?indexes=${request.sheet}`;
        if (request.filters?.length > 0) {
            query += '&filters=' + request.filters.join(',');
        }
    }
    if (request.columns?.length > 0) {
        query += '&columns=' + request.columns.join(',');
    }
    const i = 1;
    // Do initial results first to determine how many pages to request
    const initialResults = await xivApiFetch(query + '&page=' + i).then(response => response.json());
    const pageCount = initialResults['Pagination']['PageTotal'];
    const pageLimit = request.pageLimit ? Math.min(pageCount, request.pageLimit - 1) : pageCount;
    const results = [...initialResults['Results']];
    // Doing it like this to keep results ordered.
    const additional: Promise<unknown>[] = [];
    for (let i = 2; i <= pageLimit; i++) {
        // xivapi is 20req/sec/ip, but multiple of these may be running in parallel
        await new Promise(resolve => setTimeout(resolve, 150));
        additional.push(xivApiFetch(query + '&page=' + i).then(response => response.json()));
    }
    for (const additionalData of additional) {
        results.push(...(await additionalData)['Results']);
    }
    return {Results: results};
}

export async function xivApiGetList<RequestType extends XivApiListRequest>(request: RequestType): Promise<XivApiResponse<RequestType>> {
    // TODO: raise limit after testing
    let query = `https://beta.xivapi.com/api/1/sheet/${request.sheet}?limit=250&version=6.58x2`;
    if (request.columns?.length > 0) {
        query += '&fields=' + request.columns.join(',');
    }
    let remainingPages = request.pageLimit ?? 4;
    let after = 0;
    const results = [];
    // eslint-disable-next-line no-constant-condition
    while (remainingPages-- > 0) {
        const responseRaw = await xivApiFetch(query + '&after=' + after)
            .then(response => response.json());
            const response = responseRaw['rows'];
        if (response.length > 0) {
            after += response.length;
            results.push(...response);
        }
        else {
            break;
        }
    }
    return {Results: results.map(resultRow => {
            const out = {...resultRow['fields']};
            if (request.columns.includes('ID')) {
                out['ID'] = resultRow['row_id'];
            }
            return out;
        })};

}

export function xivApiIconUrl(iconId: number, highRes: boolean = false) {
    // Pad to 6 digits, e.g. 19581 -> '019581'
    const asStr = iconId.toString(10).padStart(6, '0');
    // Get the xivapi directory, e.g. 19581 -> 019000
    const directory = asStr.substring(0, 3) + '000';
    if (highRes) {
        return `https://beta.xivapi.com/api/1/asset/ui/icon/${directory}/${asStr}_hr1.tex?format=png`;
    }
    else {
        return `https://beta.xivapi.com/api/1/asset/ui/icon/${directory}/${asStr}.tex?format=png`;
    }
}
