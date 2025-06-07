import {
    AccountInfo,
    AccountServiceClient,
    RegisterResponse,
    ValidationErrorResponse
} from "@xivgear/account-service-client/accountsvc";
import {recordError, recordEvent} from "@xivgear/common-ui/analytics/analytics";

class RefreshLoop {

    private readonly callback: () => Promise<void>;
    private readonly timeout: number;
    private currentTimer: number | null = null;

    constructor(callback: () => Promise<void>, timeout: number) {
        this.callback = callback;
        this.timeout = timeout;
    }

    start(): void {
        if (this.currentTimer === null) {
            this.scheduleNext();
        }
    }

    stop(): void {
        if (this.currentTimer !== null) {
            clearTimeout(this.currentTimer);
            this.currentTimer = null;
        }
    }

    async refresh(): Promise<void> {
        this.stop();
        try {
            await this.callback();
        }
        catch (e) {
            console.error("Error refreshing", e);
        }
        this.scheduleNext();
    }

    private scheduleNext(): void {
        this.currentTimer = window.setTimeout(() => this.refresh(), this.timeout);
    }
}

// TODO: since api client is no longer configured to throw on bad response, need to manually check all of them
export class AccountStateTracker {

    private readonly refreshLoop: RefreshLoop;
    private _accountState: AccountInfo | null = null;
    private jwt: string | null = null;

    constructor(private readonly api: AccountServiceClient<never>) {
        // 5 minute auto-refresh
        this.refreshLoop = new RefreshLoop(async () => this.refresh(), 1000 * 60 * 5 / 30);
    }

    /**
     * This will start the refresh loop, and also perform a refresh before resolving.
     */
    async init(): Promise<void> {
        this.refreshLoop.start();
        await this.refresh();
    }

    /**
     * Refresh the account state.
     *
     * This will refresh the account state, and if the account is logged in, will also refresh the JWT token.
     */
    async refresh(): Promise<void> {
        await this.refreshInfo();
        if (this.loggedIn) {
            await this.refreshToken();
        }
        else {
            this.jwt = null;
        }
    }

    /**
     * Perform a login
     *
     * @param email
     * @param password
     * @returns AccountInfo if login succeeded, null if login failed.
     */
    async login(email: string, password: string): Promise<AccountInfo | null> {
        recordEvent('loginAttempt');
        try {
            const resp = await this.api.account.login({
                email,
                password,
            });
            if (resp.ok) {
                const info = resp.data.accountInfo;
                this._accountState = info;
                recordEvent('loginSuccess');
                return info;
            }
            else if (resp.status === 401) {
                recordEvent('loginFail');
                return null;
            }
            else {
                console.error("Unknown login failure", resp);
                recordEvent('loginError', {
                    statusText: resp.statusText,
                    status: resp.status,
                });
                throw new Error(`Login failure: ${resp.status} ${resp.statusText}`);
            }
        }
        finally {
            this.refreshLoop.refresh();
        }
    }

    /**
     * Log out.
     */
    async logout(): Promise<void> {
        recordEvent('logout');
        const resp = await this.api.account.logout();
        if (!resp.ok) {
            recordEvent('logoutError', {
                statusText: resp.statusText,
                status: resp.status,
            });
            console.error("Failed to log out", resp);
            throw new Error("Failed to log out");
        }
        this._accountState = null;
        this.jwt = null;
    }

    /**
     * Refresh account info.
     *
     * @returns AccountInfo if logged in, null if not.
     */
    async refreshInfo(): Promise<AccountInfo | null> {
        const resp = await this.api.account.currentAccount();
        if (resp.ok) {
            const data = resp.data;
            if (data.loggedIn) {
                return this._accountState = data.accountInfo;
            }
            else {
                return this._accountState = null;
            }
        }
        else {
            console.error("Unknown login failure", resp);
            throw new Error(`Login failure: ${resp.status} ${resp.statusText}`);
        }
    }

    /**
     * Refresh the JWT token.
     */
    async refreshToken(): Promise<string> {
        if (!this.loggedIn) {
            return this.jwt = null;
        }
        const resp = await this.api.account.getJwt();
        if (resp.ok) {
            const jwt = resp.data.token;
            this.jwt = jwt;
            return jwt;
        }
        else if (resp.status === 401) {
            this.jwt = null;
            return null;
        }
        else {
            console.error("Unknown login failure", resp);
            throw new Error(`Login failure: ${resp.status} ${resp.statusText}`);
        }
    }

    /**
     * Whether the user is logged in.
     */
    get loggedIn(): boolean {
        return this._accountState !== null;
    }

    /**
     * Current logged-in account info, or null if not logged in.
     */
    get accountState(): AccountInfo | null {
        return this._accountState;
    }

    /**
     * Registers a new user with the provided email, password, and display name.
     *
     * @param email - The email address of the user to be registered.
     * @param password - The password for the user account.
     * @param displayName - The display name of the user.
     * @return A promise that resolves to the registration response on success, or a validation error response if the
     * request fails due to validation errors. Throws an error for other types of failures.
     */
    async register(email: string, password: string, displayName: string): Promise<RegisterResponse | ValidationErrorResponse> {
        recordEvent('registerAttempt');
        const promise = await this.api.account.register({
            email,
            password,
            displayName,
        });
        if (promise.ok) {
            recordEvent('registerSuccess');
            return promise.data;
        }
        else if (promise.status === 400) {
            // validation failed
            recordEvent('registerFail');
            return promise.error;
        }
        else {
            // other error
            recordEvent('registerError', {
                statusText: promise.statusText,
                status: promise.status,
            });
            throw Error("TODO");
        }
    }

    /**
     * The JWT token for the current user, or null if not logged in.
     */
    get token(): string | null {
        return this.jwt;
    }

    /**
     * Submits a verification code to verify the user's email address.
     *
     * @param number
     */
    async submitVerificationCode(number: number): Promise<boolean> {
        recordEvent('verifyEmailAttempt');
        const response = await this.api.account.verifyEmail({
            code: number,
            email: this.accountState.email,
        });
        if (response.ok) {
            this._accountState = response.data.accountInfo;
            recordEvent('verifyEmailSuccess');
            return response.data.verified;
        }
        else {
            console.error("Failed to verify email", response);
            recordEvent('verifyEmailFailure');
            return false;
        }
    }

    /**
     * Requests that the verification code be resent to the user's email address.
     */
    async resendVerificationCode(): Promise<void> {
        recordEvent('resendVerificationCode');
        await this.api.account.resendVerificationCode();
    }
}


const apiClient = new AccountServiceClient<never>({
    baseUrl: 'https://accountsvc.xivgear.app',
    // baseUrl: 'http://192.168.1.119:8086',
    customFetch: cookieFetch,
});

export const ACCOUNT_STATE_TRACKER = new AccountStateTracker(apiClient);

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        accStateTracker?: AccountStateTracker;
    }
}
window.accStateTracker = ACCOUNT_STATE_TRACKER;

async function cookieFetch(...params: Parameters<typeof fetch>): Promise<Response> {
    const headers = new Headers(params[1]?.headers ?? []);
    // Backend requires this header to be set, to protect against simple CSRF attacks.
    // Form submission allows cross-site requests, but form submissions cannot have additional headers.
    headers.append("xivgear-csrf", "1");
    return fetch(params[0], {
        ...(params[1] ?? {}),
        credentials: 'include',
        headers: headers,
    });
}
