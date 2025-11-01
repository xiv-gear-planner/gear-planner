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

export enum SpecialStatType {
  OccultCrescent = "OccultCrescent",
}

export enum GearAcquisitionSource {
  NormalRaid = "NormalRaid",
  SavageRaid = "SavageRaid",
  Tome = "Tome",
  AugTome = "AugTome",
  Crafted = "Crafted",
  AugCrafted = "AugCrafted",
  Relic = "Relic",
  Dungeon = "Dungeon",
  ExtremeTrial = "ExtremeTrial",
  Ultimate = "Ultimate",
  Artifact = "Artifact",
  AllianceRaid = "AllianceRaid",
  Criterion = "Criterion",
  Other = "Other",
  Custom = "Custom",
  Unknown = "Unknown",
}

export type BaseParam = XivApiObject &
  XivApiBase & {
    name?: string;
    /** @format int32 */
    twoHandWeaponPercent?: number;
    /** @format int32 */
    oneHandWeaponPercent?: number;
    /** @format int32 */
    offHandPercent?: number;
    /** @format int32 */
    headPercent?: number;
    /** @format int32 */
    chestPercent?: number;
    /** @format int32 */
    handsPercent?: number;
    /** @format int32 */
    legsPercent?: number;
    /** @format int32 */
    feetPercent?: number;
    /** @format int32 */
    earringPercent?: number;
    /** @format int32 */
    necklacePercent?: number;
    /** @format int32 */
    braceletPercent?: number;
    /** @format int32 */
    ringPercent?: number;
    meldParam?: number[];
  };

export interface BaseParamEndpointResponse {
  items?: BaseParam[];
}

export type ClassJob = XivApiObject &
  XivApiBase & {
    abbreviation?: string;
    abbreviationTranslations?: XivApiLangValueString;
    nameTranslations?: XivApiLangValueString;
    /** @format int32 */
    modifierDexterity?: number;
    /** @format int32 */
    modifierHitPoints?: number;
    /** @format int32 */
    modifierIntelligence?: number;
    /** @format int32 */
    modifierMind?: number;
    /** @format int32 */
    modifierPiety?: number;
    /** @format int32 */
    modifierStrength?: number;
    /** @format int32 */
    modifierVitality?: number;
  };

export type EquipSlotCategory = XivApiObject &
  XivApiBase & {
    /** @format int32 */
    mainHand?: number;
    /** @format int32 */
    offHand?: number;
    /** @format int32 */
    head?: number;
    /** @format int32 */
    body?: number;
    /** @format int32 */
    gloves?: number;
    /** @format int32 */
    legs?: number;
    /** @format int32 */
    feet?: number;
    /** @format int32 */
    ears?: number;
    /** @format int32 */
    neck?: number;
    /** @format int32 */
    wrists?: number;
    /** @format int32 */
    fingerL?: number;
    /** @format int32 */
    fingerR?: number;
  };

export type Food = FoodItemBase &
  XivApiObject &
  XivApiBase & {
    bonuses?: Record<string, FoodStatBonus>;
    bonusesHQ?: Record<string, FoodStatBonus>;
  };

export interface FoodEndpointResponse {
  items?: Food[];
}

export type FoodItemAction = XivApiObject &
  XivApiBase & {
    data?: number[];
  };

export type FoodItemBase = XivApiObject &
  XivApiBase & {
    name?: string;
    nameTranslations?: XivApiLangValueString;
    icon?: Icon;
    /** @format int32 */
    levelItem?: number;
    itemAction?: FoodItemAction;
    /** @format int32 */
    foodItemId?: number;
  };

export interface FoodStatBonus {
  /** @format int32 */
  percentage: number;
  /** @format int32 */
  max: number;
}

export type Icon = XivApiStruct &
  XivApiBase & {
    /** @format uri */
    pngIconUrl?: string;
  };

export type Item = ItemBase &
  XivApiObject &
  XivApiBase & {
    baseParamMap?: Record<string, number>;
    baseParamMapHQ?: Record<string, number>;
    baseParamMapSpecial?: Record<string, number>;
    specialStatType?: SpecialStatType | null;
    classJobs?: string[];
    /** @format int32 */
    damageMagHQ?: number;
    /** @format int32 */
    damagePhysHQ?: number;
    acquisitionSource?: GearAcquisitionSource;
    /** @format int32 */
    defenseMagHQ?: number;
    /** @format int32 */
    defensePhysHQ?: number;
  };

export type ItemBase = XivApiObject &
  XivApiBase & {
    /** @format int32 */
    ilvl?: number;
    name?: string;
    nameTranslations?: XivApiLangValueString;
    icon?: Icon;
    equipSlotCategory?: EquipSlotCategory;
    /** @format int32 */
    damageMag?: number;
    /** @format int32 */
    damagePhys?: number;
    /** @format int32 */
    delayMs?: number;
    /** @format int32 */
    materiaSlotCount?: number;
    advancedMeldingPermitted?: boolean;
    canBeHq?: boolean;
    unique?: boolean;
    /** @format int32 */
    rarity?: number;
    /** @format int32 */
    equipLevel?: number;
    /** @format int32 */
    defensePhys?: number;
    /** @format int32 */
    defenseMag?: number;
  };

export type ItemLevel = XivApiObject &
  XivApiBase & {
    /** @format int32 */
    criticalHit?: number;
    /** @format int32 */
    defense?: number;
    /** @format int32 */
    delay?: number;
    /** @format int32 */
    determination?: number;
    /** @format int32 */
    dexterity?: number;
    /** @format int32 */
    directHitRate?: number;
    /** @format int32 */
    HP?: number;
    /** @format int32 */
    intelligence?: number;
    /** @format int32 */
    magicDefense?: number;
    /** @format int32 */
    magicalDamage?: number;
    /** @format int32 */
    mind?: number;
    /** @format int32 */
    physicalDamage?: number;
    /** @format int32 */
    piety?: number;
    /** @format int32 */
    skillSpeed?: number;
    /** @format int32 */
    spellSpeed?: number;
    /** @format int32 */
    strength?: number;
    /** @format int32 */
    tenacity?: number;
    /** @format int32 */
    vitality?: number;
  };

export interface ItemLevelEndpointResponse {
  items?: ItemLevel[];
}

export interface ItemsEndpointResponse {
  items?: Item[];
}

export interface JobEndpointResponse {
  items?: ClassJob[];
}

export type Materia = XivApiObject &
  XivApiBase & {
    item?: MateriaItem[];
    value?: number[];
    /** @format int32 */
    baseParam?: number;
  };

export interface MateriaEndpointResponse {
  items?: Materia[];
}

export type MateriaItem = XivApiObject &
  XivApiBase & {
    name?: string;
    nameTranslations?: XivApiLangValueString;
    icon?: Icon;
    /** @format int32 */
    ilvl?: number;
  };

export interface SchemaVersionEndpointResponse {
  schemaVersion?: string;
}

export interface VersionsEndpointResponse {
  versions?: string[];
}

export interface XivApiBase {
  schemaVersion?: XivApiSchemaVersion;
}

export interface XivApiLangValueString {
  en?: string;
  de?: string;
  fr?: string;
  ja?: string;
}

export type XivApiObject = XivApiBase & {
  /** @format int32 */
  primaryKey?: number;
  /** @format int32 */
  rowId?: number;
};

export type XivApiSchemaVersion = object;

export type XivApiStruct = XivApiBase;

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
 * @title XivGear Reference Data API
 * @version 0.1
 * @license GPLv3
 * @contact Discord: xp
 *
 * Game data API for XivGear
 */
export class DataApiClient<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  baseParams = {
    /**
     * No description
     *
     * @name BaseParams
     * @summary Get BaseParams
     * @request GET:/BaseParams
     */
    baseParams: (params: RequestParams = {}) =>
      this.request<BaseParamEndpointResponse, any>({
        path: `/BaseParams`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  food = {
    /**
     * No description
     *
     * @name FoodItems
     * @summary Get food items
     * @request GET:/Food
     */
    foodItems: (params: RequestParams = {}) =>
      this.request<FoodEndpointResponse, any>({
        path: `/Food`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  itemLevel = {
    /**
     * No description
     *
     * @name ItemLevels
     * @summary Get ItemLevel data
     * @request GET:/ItemLevel
     */
    itemLevels: (params: RequestParams = {}) =>
      this.request<ItemLevelEndpointResponse, any>({
        path: `/ItemLevel`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  items = {
    /**
     * No description
     *
     * @name Items
     * @summary Get applicable gear items
     * @request GET:/Items
     */
    items: (
      query: {
        job: string[];
      },
      params: RequestParams = {},
    ) =>
      this.request<ItemsEndpointResponse, any>({
        path: `/Items`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),
  };
  jobs = {
    /**
     * No description
     *
     * @name Jobs
     * @summary Get Job data
     * @request GET:/Jobs
     */
    jobs: (params: RequestParams = {}) =>
      this.request<JobEndpointResponse, any>({
        path: `/Jobs`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  materia = {
    /**
     * No description
     *
     * @name Materia
     * @summary Get Materia
     * @request GET:/Materia
     */
    materia: (params: RequestParams = {}) =>
      this.request<MateriaEndpointResponse, any>({
        path: `/Materia`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  schemaVersion = {
    /**
     * No description
     *
     * @name Versions
     * @summary Get the Xivapi schema version used to query the data.
     * @request GET:/SchemaVersion
     */
    versions: (params: RequestParams = {}) =>
      this.request<SchemaVersionEndpointResponse, any>({
        path: `/SchemaVersion`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  versions = {
    /**
     * No description
     *
     * @name Versions1
     * @summary Get versions available via Xivapi at the time the data was polled.
     * @request GET:/Versions
     */
    versions1: (params: RequestParams = {}) =>
      this.request<VersionsEndpointResponse, any>({
        path: `/Versions`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
  healthz = {
    /**
     * No description
     *
     * @name HealthCheck
     * @summary Health Check
     * @request GET:/healthz
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
     */
    readyCheck: (params: RequestParams = {}) =>
      this.request<string, any>({
        path: `/readyz`,
        method: "GET",
        ...params,
      }),
  };
}
