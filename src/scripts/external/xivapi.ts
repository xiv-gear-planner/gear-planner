export function xivApiIcon(iconStub: string) {
    return new URL("https://xivapi.com/" + iconStub);
}


async function allCommon<Keys extends string>(urlBase: string, filters: string[], columns: Keys[]):
    Promise<{
        Results: [{
            [K in Keys]: any
        }]
    }> {
    let query = urlBase;
    if (filters?.length > 0) {
        query += '&filters=' + filters.join(',');
    }
    if (columns?.length > 0) {
        query += '&columns=' + columns.join(',');
    }
    let i = 1;
    // Do initial results first to determine how many pages to request
    const initialResults = await fetch(query + '&page=' + i).then(response => response.json());
    const pageCount = initialResults['Pagination']['PageTotal'];
    const results = [...initialResults['Results']];
    // Doing it like this to keep results ordered.
    const additional: Promise<any>[] = [];
    for (let i = 1; i <= pageCount; i++) {
        // xivapi is 20req/sec/ip, but multiple of these may be running in parallel
        await new Promise(resolve => setTimeout(resolve, 150));
        additional.push(fetch(query + '&page=' + i).then(response => response.json()));
    }
    for (let additionalData of additional) {
        results.push(...(await additionalData)['Results']);
    }
    // @ts-ignore
    return {Results: results};

}


export async function getAll<Keys extends string>(index: string, filters: string[], columns: Keys[]):
    Promise<{
        Results: [{
            [K in Keys]: any
        }]
    }> {
    let query = `https://xivapi.com/${index}?`;
    return allCommon(query, filters, columns);
}

export async function searchAll<Keys extends string>(index: string, filters: string[], columns: Keys[]):
    Promise<{
        Results: [{
            [K in Keys]: any
        }]
    }> {
    let query = `https://xivapi.com/search?indexes=${index}`;
    return allCommon(query, filters, columns);
}
