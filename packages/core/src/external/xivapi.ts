export type XivApiRequest = {
    requestType: 'list' | 'search',
    sheet: string,
    columns?: readonly string[],
    columnsTrn?: readonly string[]
    perPage?: number
    startPage?: number,
    pageLimit?: number
}

export type XivApiListRequest = XivApiRequest & {
    requestType: 'list',
    rows?: number[],
}

export type XivApiFilter = string;

export type XivApiSearchRequest = XivApiRequest & {
    requestType: 'search',
    filters?: XivApiFilter[],
}

export const XIVAPI_SERVER = "https://beta.xivapi.com";

export type XivApiResultSingle<Cols extends readonly string[], TrnCols extends readonly string[] = []> = {
    [K in Cols[number]]: unknown;
} & {
    [K in TrnCols[number]]: unknown;
} & {
    ID: number
}

export type XivApiResponse<RequestType extends XivApiRequest> = {
    Results: XivApiResultSingle<RequestType['columns'], RequestType['columnsTrn']>[]
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
        if (result.status >= 400) {
            const content = JSON.stringify(await result.json());
            console.error(`XivApi error: ${result.status}: ${result.statusText}`, params[0], content);
            throw Error(`XivApi error: ${result.status}: ${result.statusText} (${params[0]}\n${content}`);
        }
        return result;
    }
}

export async function xivApiSingle(sheet: string, id: number) {
    const query = `${XIVAPI_SERVER}/api/1/sheet/${sheet}/${id}`;
    return xivApiFetch(query).then(response => response.json()).then(response => response['fields']);
}

export async function xivApiSingleCols<Columns extends readonly string[]>(sheet: string, id: number, cols: Columns): Promise<{
    [K in Columns[number]]: unknown;
} & {
    ID: number
}> {
    const query = `${XIVAPI_SERVER}/api/1/sheet/${sheet}/${id}?fields=${cols.join(',')}`;
    return xivApiFetch(query).then(response => response.json()).then(response => {
        const responseOut = response['fields'];
        responseOut['ID'] = response['row_id'];
        return responseOut;
    });
}

export async function xivApiGet<RequestType extends (XivApiListRequest | XivApiSearchRequest)>(request: RequestType):
    Promise<XivApiResponse<RequestType>> {
    if (request.requestType === 'list') {
        return await xivApiGetList(request) as XivApiResponse<RequestType>;
    }
    else {
        return await xivApiSearch(request) as XivApiResponse<RequestType>;
    }
}

const DEFAULT_PER_PAGE = 250;

export async function xivApiSearch<RequestType extends XivApiSearchRequest>(request: RequestType): Promise<XivApiResponse<RequestType>> {
    const perPage = request.perPage ?? DEFAULT_PER_PAGE;
    let query = `${XIVAPI_SERVER}/api/1/search?sheets=${request.sheet}&limit=${perPage}`;
    if (request.columns?.length > 0) {
        query += '&fields=' + request.columns.join(',');
    }
    let queryInitial = query;
    const after: number = request.startPage !== undefined ? (request.startPage * perPage) : 0;
    queryInitial += `&after=${after}`;
    if (request.filters?.length > 0) {
        const filterFmt = request.filters.map(filter => encodeURIComponent('+' + filter)).join(encodeURIComponent(' '));
        queryInitial += `&query=${filterFmt}`;
    }
    let remainingPages = request.pageLimit ?? 4;
    let lastCursor: string | null = null;
    const results = [];
    while (remainingPages-- > 0) {
        let thisQuery: string;
        if (lastCursor !== null) {
            thisQuery = query + '&cursor=' + lastCursor;
        }
        else {
            thisQuery = queryInitial;
        }
        const responseRaw = await xivApiFetch(thisQuery)
            .then(response => response.json());
        const response = responseRaw['results'];
        results.push(...response.filter(isNonEmpty));
        const thisNext = responseRaw['next'];
        if (thisNext === undefined) {
            break;
        }
        lastCursor = thisNext ?? null;
    }
    if (remainingPages <= 0 && !request.pageLimit) {
        console.warn(`Exceeded xivapi page limit for query ${queryInitial}`);
    }
    return {
        Results: results.map(resultRow => {
            const out = {...resultRow['fields']};
            out['ID'] = resultRow['row_id'];
            return out;
        })
    };

}


export async function xivApiGetList<RequestType extends XivApiListRequest>(request: RequestType): Promise<XivApiResponse<RequestType>> {
    // TODO: raise limit after testing
    const perPage = request.perPage ?? DEFAULT_PER_PAGE;
    let query = `${XIVAPI_SERVER}/api/1/sheet/${request.sheet}?limit=${perPage}`;
    if (request.columns?.length > 0) {
        query += '&fields=' + request.columns.join(',');
    }
    if (request.rows != null) {
        query += '&rows=' + request.rows.join(',');
    }
    let remainingPages = request.pageLimit ?? 4;
    let after = request.startPage !== undefined ? (request.startPage * perPage) : 0;
    const results = [];
    while (remainingPages-- > 0) {
        const responseRaw = await xivApiFetch(query + '&after=' + after)
            .then(response => response.json());
        const response = responseRaw['rows'];
        if (response.length > 0) {
            after += response.length;
            results.push(...response.filter(isNonEmpty));
            if (response.length < perPage) {
                break;
            }
        }
        else {
            break;
        }
    }
    if (remainingPages <= 0 && !request.pageLimit) {
        console.warn(`Exceeded xivapi page limit for query ${query}`);
    }
    return {
        Results: results.map(resultRow => {
            const out = {...resultRow['fields']};
            out['ID'] = resultRow['row_id'];
            return out;
        })
    };
}

function isNonEmpty(row: object) {
    return row['row_id'] > 0 && Object.keys(row['fields']).length > 0;
}

export function xivApiIconUrl(iconId: number, highRes: boolean = false) {
    // Pad to 6 digits, e.g. 19581 -> '019581'
    const asStr = iconId.toString(10).padStart(6, '0');
    // Get the xivapi directory, e.g. 19581 -> 019000
    const directory = asStr.substring(0, 3) + '000';
    if (highRes) {
        return `${XIVAPI_SERVER}/api/1/asset/ui/icon/${directory}/${asStr}_hr1.tex?format=png`;
    }
    else {
        return `${XIVAPI_SERVER}/api/1/asset/ui/icon/${directory}/${asStr}.tex?format=png`;
    }
}
