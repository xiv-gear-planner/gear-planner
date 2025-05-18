import {DataApiClient, HttpResponse} from "@xivgear/data-api-client/dataapi";

export type ApiClientRawType<X extends keyof DataApiClient<never>, Y extends keyof DataApiClient<never>[X]> = DataApiClient<never>[X][Y];

export type ApiItemData = Awaited<ReturnType<ApiClientRawType<'items', 'items'>>>['data']['items'][number];
export type ApiMateriaData = Awaited<ReturnType<ApiClientRawType<'materia', 'materia'>>>['data']['items'][number];
export type ApiFoodData = Awaited<ReturnType<ApiClientRawType<'food', 'foodItems'>>>['data']['items'][number];
// type BaseParamType = Awaited<ReturnType<ApiClientRawType<'baseParams', 'baseParams'>>>['data']['items'][number]
export type ApiJobType = Awaited<ReturnType<ApiClientRawType<'jobs', 'jobs'>>>['data']['items'][number];
// type ItemLevelType = Awaited<ReturnType<ApiClientRawType<'itemLevel', 'itemLevels'>>>['data']['items'][number]

export type DataManagerErrorReporter = (r: Response, params: Parameters<typeof fetch>) => void;

let errorReporter: DataManagerErrorReporter = () => {
};

export function setDataManagerErrorReporter(reporter: DataManagerErrorReporter) {
    errorReporter = reporter;
}

async function retryFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    let tries = 5;
    while (true) {
        tries--;
        const result = await fetch(...params);
        // TODO: add other errors here?
        if (tries > 0 && result.status === 503 && result.statusText === 'Not Ready') {
            console.log("data api not ready, retrying", params[0]);
            await new Promise(r => setTimeout(r, 5_000 + (Math.random() * 1000)));
            continue;
        }
        if (result.status >= 400) {
            const content = JSON.stringify(await result.json());
            console.error(`Data API error: ${result.status}: ${result.statusText}`, params[0], content);
            const error = Error(`Data API error: ${result.status}: ${result.statusText} (${params[0]}\n${content}`);
            // TODO: it would be nice to be able to record these, but they would create an unacceptable
            // dependency loop.
            // recordError("datamanager", error, {fetchUrl: String(params[0])});
            throw error;
        }
        if (!result.ok) {
            console.error(`Data API error: ${result.status}: ${result.statusText}`, params[0]);
            errorReporter(result, params);
            throw new Error(`Data API error: ${result.status}: ${result.statusText} (${params[0]}`);
        }
        return result;
    }
}

export const API_CLIENT = new DataApiClient<never>({
    // baseUrl: "https://data.xivgear.app",
    // baseUrl: "https://betadata.xivgear.app",
    baseUrl: "http://localhost:8085",
    customFetch: retryFetch,
});

export function setDataApi(baseUrl: string) {
    API_CLIENT.baseUrl = baseUrl;
}

export function checkResponse<X extends HttpResponse<unknown>>(response: X): X {
    const url = response.url;
    if (!response.ok) {
        errorReporter(response, [url]);
        throw new Error(`Data API error: response not ok: ${response.status}: ${response.statusText} (${url}`);
    }
    else if (!response.data) {
        errorReporter(response, [url]);
        throw new Error(`Data API error: no data: ${response.status}: ${response.statusText} (${url}`);
    }
    return response;
}
