import {DataApiClient, HttpResponse} from "@xivgear/data-api-client/dataapi";

export type ApiClientRawType<X extends keyof DataApiClient<never>, Y extends keyof DataApiClient<never>[X]> = DataApiClient<never>[X][Y];

// TODO: the NonNullable part is only there because there doesn't seem to be a good way to bulk annotate fields as
// required on the OpenAPI/Micronaut side.
// See https://github.com/micronaut-projects/micronaut-core/issues/8822
export type ApiItemData = NonNullable<Awaited<ReturnType<ApiClientRawType<'items', 'items'>>>['data']['items']>[number];
export type ApiMateriaData = NonNullable<Awaited<ReturnType<ApiClientRawType<'materia', 'materia'>>>['data']['items']>[number];
export type ApiFoodData = NonNullable<Awaited<ReturnType<ApiClientRawType<'food', 'foodItems'>>>['data']['items']>[number];
// type BaseParamType = Awaited<ReturnType<ApiClientRawType<'baseParams', 'baseParams'>>>['data']['items'][number]
export type ApiJobType = NonNullable<Awaited<ReturnType<ApiClientRawType<'jobs', 'jobs'>>>['data']['items']>[number];
// type ItemLevelType = Awaited<ReturnType<ApiClientRawType<'itemLevel', 'itemLevels'>>>['data']['items'][number]

export type DataManagerErrorReporter = (r: Response, params: Parameters<typeof fetch>) => void;

let errorReporter: DataManagerErrorReporter = () => {
};

export function setDataManagerErrorReporter(reporter: DataManagerErrorReporter) {
    errorReporter = reporter;
}

async function retryFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    const url = params[0];
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
            let content: string;
            try {
                content = JSON.stringify(await result.json());
            }
            catch (e) {
                console.error(`Data API error: ${result.status}: ${result.statusText} (failed to parse content)`, params[0], e);
                throw Error(`Data API error on ${url}: ${result.status}: ${result.statusText} (failed to parse content: ${e})`);
            }
            console.error(`Data API error: ${result.status}: ${result.statusText}`, params[0], content);
            throw Error(`Data API error on ${url}: ${result.status}: ${result.statusText} (${params[0]}\n${content}`);
        }
        if (!result.ok) {
            console.error(`Data API error: ${result.status}: ${result.statusText}`, params[0]);
            errorReporter(result, params);
            throw new Error(`Data API error on ${url}: ${result.status}: ${result.statusText} (${params[0]}`);
        }
        return result;
    }
}

export const DATA_API_CLIENT = new DataApiClient<never>({
    // baseUrl: "https://data.xivgear.app",
    baseUrl: "https://betadata.xivgear.app",
    // baseUrl: "http://localhost:8085",
    customFetch: retryFetch,
});

export function setDataApi(baseUrl: string) {
    DATA_API_CLIENT.baseUrl = baseUrl;
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
