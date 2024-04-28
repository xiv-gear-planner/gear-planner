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
        [K in RequestType['columns'][number]]: any;
    }[]
}

// export type ValidRequest<RequestType extends XivApiRequest> = RequestType['requestType'] extends 'search' ? XivApiSearchRequest : XivApiListRequest;

// export async function xivApiGet<RequestType extends (XivApiListRequest | XivApiSearchRequest)>(request: RequestType | ValidRequest<RequestType>):

export function xivApiFetch(...params: Parameters<typeof fetch>): Promise<any> {
    return xFetchInternal(...params);
}

async function xFetchInternal(...params: Parameters<typeof fetch>): Promise<any> {
    let tries = 5;
    while (true) {
        tries --;
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

export function xivApiSingle(sheet: string, id: number) {
    const query = `https://xivapi.com/${sheet}/${id}`;
    return xivApiFetch(query).then(response => response.json());
}

export function xivApiSingleCols<Columns extends readonly string[]>(sheet: string, id: number, cols: Columns): Promise<{
    [K in Columns[number]]: any;
}> {
    const query = `https://xivapi.com/${sheet}/${id}?Columns=${cols.join(',')}`;
    return fetch(query).then(response => response.json());
}

export async function xivApiGet<RequestType extends (XivApiListRequest | XivApiSearchRequest)>(request: RequestType):
    Promise<XivApiResponse<RequestType>> {
    let query: string;
    if (request.requestType === 'list') {
        query = `https://xivapi.com/${request.sheet}?`;
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
    let i = 1;
    // Do initial results first to determine how many pages to request
    const initialResults = await xivApiFetch(query + '&page=' + i).then(response => response.json());
    const pageCount = initialResults['Pagination']['PageTotal'];
    const pageLimit = request.pageLimit ? Math.min(pageCount, request.pageLimit - 1) : pageCount;
    const results = [...initialResults['Results']];
    // Doing it like this to keep results ordered.
    const additional: Promise<any>[] = [];
    for (let i = 2; i <= pageLimit; i++) {
        // xivapi is 20req/sec/ip, but multiple of these may be running in parallel
        await new Promise(resolve => setTimeout(resolve, 150));
        additional.push(xivApiFetch(query + '&page=' + i).then(response => response.json()));
    }
    for (let additionalData of additional) {
        results.push(...(await additionalData)['Results']);
    }
    // @ts-ignore
    return {Results: results};

}