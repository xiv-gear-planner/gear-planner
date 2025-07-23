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

export interface AccountInfo {
  /** @format int32 */
  uid?: number;
  email?: string;
  roles?: string[];
  verified?: boolean;
  displayName?: string;
}

export interface AccountInfoResponse {
  loggedIn?: boolean;
  accountInfo?: AccountInfo | null;
}

export interface ChangePasswordRequest {
  existingPassword?: string;
  /** @minLength 8 */
  newPassword?: string;
}

export interface ChangePasswordResponse {
  passwordCorrect?: boolean;
}

export interface FinalizePasswordResetRequest {
  /**
   * @format email
   * @minLength 1
   */
  email: string;
  /** @format int32 */
  token?: number;
  /** @minLength 8 */
  newPassword?: string;
}

export interface InitiatePasswordResetRequest {
  /**
   * @format email
   * @minLength 1
   */
  email: string;
}

export interface JwtResponse {
  token?: string;
}

export interface LoginRequest {
  email?: string;
  password?: string;
}

export interface LoginResponse {
  accountInfo?: AccountInfo;
  message?: string;
}

export interface RegisterRequest {
  /**
   * @format email
   * @minLength 1
   */
  email: string;
  /** @minLength 8 */
  password?: string;
  /**
   * @minLength 2
   * @maxLength 64
   */
  displayName?: string;
}

export interface RegisterResponse {
  /** @format int32 */
  uid?: number;
}

export interface ValidationErrorResponse {
  validationErrors?: ValidationErrorSingle[];
}

export interface ValidationErrorSingle {
  path?: string;
  field?: string;
  message?: string;
}

export interface VerifyEmailRequest {
  /** @format email */
  email?: string;
  /** @format int32 */
  code?: number;
}

export interface VerifyEmailResponse {
  verified?: boolean;
  accountInfo?: AccountInfo;
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

      return data;
    });
  };
}

/**
 * @title xivgear-account-service
 * @version 0.0
 */
export class AccountServiceClient<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  account = {
    /**
     * No description
     *
     * @name ChangePassword
     * @request POST:/account/changePassword
     * @secure
     * @response `200` `ChangePasswordResponse` changePassword 200 response
     */
    changePassword: (data: ChangePasswordRequest, params: RequestParams = {}) =>
      this.request<ChangePasswordResponse, any>({
        path: `/account/changePassword`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CurrentAccount
     * @request GET:/account/current
     * @secure
     * @response `200` `AccountInfoResponse` currentAccount 200 response
     */
    currentAccount: (params: RequestParams = {}) =>
      this.request<AccountInfoResponse, any>({
        path: `/account/current`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name FinalizePasswordReset
     * @request POST:/account/finalizePasswordReset
     * @secure
     * @response `200` `object` finalizePasswordReset 200 response
     */
    finalizePasswordReset: (
      data: FinalizePasswordResetRequest,
      params: RequestParams = {},
    ) =>
      this.request<object, any>({
        path: `/account/finalizePasswordReset`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AccountInfo
     * @request GET:/account/info
     * @secure
     * @response `200` `AccountInfo` accountInfo 200 response
     */
    accountInfo: (params: RequestParams = {}) =>
      this.request<AccountInfo, any>({
        path: `/account/info`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name InitiatePasswordReset
     * @request POST:/account/initiatePasswordReset
     * @secure
     * @response `200` `object` initiatePasswordReset 200 response
     */
    initiatePasswordReset: (
      data: InitiatePasswordResetRequest,
      params: RequestParams = {},
    ) =>
      this.request<object, any>({
        path: `/account/initiatePasswordReset`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GetJwt
     * @request GET:/account/jwt
     * @secure
     * @response `200` `JwtResponse` getJwt 200 response
     */
    getJwt: (params: RequestParams = {}) =>
      this.request<JwtResponse, any>({
        path: `/account/jwt`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name Login
     * @request POST:/account/login
     * @secure
     * @response `200` `LoginResponse` login 200 response
     */
    login: (data: LoginRequest, params: RequestParams = {}) =>
      this.request<LoginResponse, any>({
        path: `/account/login`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name Logout
     * @request POST:/account/logout
     * @secure
     * @response `200` `object` logout 200 response
     */
    logout: (params: RequestParams = {}) =>
      this.request<object, any>({
        path: `/account/logout`,
        method: "POST",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name Register
     * @request POST:/account/register
     * @secure
     * @response `200` `RegisterResponse` Successful registration
     * @response `400` `ValidationErrorResponse` Validation error
     */
    register: (data: RegisterRequest, params: RequestParams = {}) =>
      this.request<RegisterResponse, ValidationErrorResponse>({
        path: `/account/register`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ResendVerificationCode
     * @request POST:/account/resendVerificationCode
     * @secure
     * @response `200` `void` resendVerificationCode 200 response
     */
    resendVerificationCode: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/account/resendVerificationCode`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @name VerifyEmail
     * @request POST:/account/verify
     * @secure
     * @response `200` `VerifyEmailResponse` verifyEmail 200 response
     */
    verifyEmail: (data: VerifyEmailRequest, params: RequestParams = {}) =>
      this.request<VerifyEmailResponse, any>({
        path: `/account/verify`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
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
}
