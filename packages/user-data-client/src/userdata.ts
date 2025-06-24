/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface DeleteSheetRequest {
  /** @format int32 */
  lastSyncedVersion?: number;
  /** @format int32 */
  newSheetVersion?: number;
}

export interface DeleteSheetResponse {
  success?: boolean;
  conflict?: boolean;
}

export interface GetPreferencesResponse {
  found?: boolean;
  preferences?: UserPreferences | null;
  /** @format int32 */
  nextSetId?: number;
}

export interface GetSheetResponse {
  metadata?: SheetMetadata;
  sheetData?: Record<string, any>;
}

export interface GetSheetsResponse {
  sheets?: SheetMetadata[];
}

export interface PutPreferencesRequest {
  preferences?: UserPreferences | null;
  /** @format int32 */
  nextSetId?: number;
}

export interface PutSheetRequest {
  /** @format int32 */
  lastSyncedVersion?: number;
  /** @format int32 */
  newSheetVersion?: number;
  /** @format double */
  sortOrder?: number | null;
  sheetData: Record<string, any>;
  sheetSummary: SheetSummary;
}

export interface PutSheetResponse {
  success?: boolean;
  conflict?: boolean;
}

export interface SheetMetadata {
  saveKey?: string;
  /** @format int32 */
  version?: number;
  /** @format double */
  sortOrder?: number | null;
  deleted?: boolean;
  summary?: SheetSummary;
}

export interface SheetSummary {
  /** @maxLength 64 */
  job: string;
  /** @maxLength 128 */
  name: string;
  multiJob?: boolean;
  /** @format int32 */
  level?: number;
  /**
   * @format int32
   * @min 0
   */
  isync?: number | null;
}

export interface UserPreferences {
  lightMode?: boolean;
  /** @maxLength 64 */
  languageOverride?: string | null;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData()),
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response.clone() as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title xivgear-userdata-service
 * @version 0.0
 */
export class UserDataClient<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  healthz = {
    /**
     * No description
     *
     * @name HealthCheck
     * @summary Health Check
     * @request GET:/healthz
     * @response `200` `string` healthCheck 200 response
     */
    healthCheck: (params: RequestParams = {}) =>
      this.request<string, any>({
        path: `/healthz`,
        method: "GET",
        ...params,
      }),
  };
  readyz = {
    /**
     * No description
     *
     * @name ReadyCheck
     * @summary Ready Check
     * @request GET:/readyz
     * @response `200` `string` readyCheck 200 response
     */
    readyCheck: (params: RequestParams = {}) =>
      this.request<string, any>({
        path: `/readyz`,
        method: "GET",
        ...params,
      }),
  };
  userdata = {
    /**
     * No description
     *
     * @name GetPrefs
     * @request GET:/userdata/preferences
     * @secure
     * @response `200` `GetPreferencesResponse` getPrefs 200 response
     */
    getPrefs: (params: RequestParams = {}) =>
      this.request<GetPreferencesResponse, any>({
        path: `/userdata/preferences`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name PutPrefs
     * @request PUT:/userdata/preferences
     * @secure
     * @response `200` `void` putPrefs 200 response
     */
    putPrefs: (data: PutPreferencesRequest, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/userdata/preferences`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name GetSheetsList
     * @request GET:/userdata/sheets
     * @secure
     * @response `200` `GetSheetsResponse` getSheetsList 200 response
     */
    getSheetsList: (params: RequestParams = {}) =>
      this.request<GetSheetsResponse, any>({
        path: `/userdata/sheets`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GetSheet
     * @request GET:/userdata/sheets/{sheetId}
     * @secure
     * @response `200` `GetSheetResponse` getSheet 200 response
     */
    getSheet: (sheetId: string, params: RequestParams = {}) =>
      this.request<GetSheetResponse, any>({
        path: `/userdata/sheets/${sheetId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name PutSheet
     * @request PUT:/userdata/sheets/{sheetId}
     * @secure
     * @response `200` `PutSheetResponse` putSheet 200 response
     */
    putSheet: (
      sheetId: string,
      data: PutSheetRequest,
      params: RequestParams = {},
    ) =>
      this.request<PutSheetResponse, any>({
        path: `/userdata/sheets/${sheetId}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name DeleteSheet
     * @request DELETE:/userdata/sheets/{sheetId}
     * @secure
     * @response `200` `DeleteSheetResponse` deleteSheet 200 response
     */
    deleteSheet: (
      sheetId: string,
      data: DeleteSheetRequest,
      params: RequestParams = {},
    ) =>
      this.request<DeleteSheetResponse, any>({
        path: `/userdata/sheets/${sheetId}`,
        method: "DELETE",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}
