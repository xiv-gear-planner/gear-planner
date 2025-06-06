import {
    AccountInfo,
    AccountServiceClient,
    RegisterResponse,
    ValidationErrorResponse
} from "@xivgear/account-service-client/accountsvc";

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

    async init(): Promise<void> {
        this.refreshLoop.start();
        await this.refresh();
    }

    async refresh(): Promise<void> {
        await this.refreshInfo();
        if (this.loggedIn) {
            await this.refreshToken();
        }
        else {
            this.jwt = null;
        }
    }

    async login(email: string, password: string): Promise<AccountInfo | null> {
        try {

            const resp = await this.api.account.login({
                email,
                password,
            });
            if (resp.ok) {
                const info = resp.data.accountInfo;
                this._accountState = info;
                return info;
            }
            else if (resp.status === 401) {
                return null;
            }
            else {
                console.error("Unknown login failure", resp);
                throw new Error(`Login failure: ${resp.status} ${resp.statusText}`);
            }
        }
        finally {
            this.refreshLoop.refresh();
        }
    }

    async logout(): Promise<void> {
        const resp = await this.api.account.logout();
        if (!resp.ok) {
            console.error("Failed to log out", resp);
            throw new Error("Failed to log out");
        }
        this._accountState = null;
        this.jwt = null;
    }

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

    get loggedIn(): boolean {
        return this._accountState !== null;
    }

    get accountState(): AccountInfo | null {
        return this._accountState;
    }

    async register(email: string, password: string, displayName: string): Promise<RegisterResponse | ValidationErrorResponse> {
        const promise = await this.api.account.register({
            email,
            password,
            displayName,
        });
        if (promise.ok) {
            return promise.data;
        }
        else if (promise.status === 400) {
            // validation failed
            return promise.error;
        }
        else {
            // other error
            throw Error("TODO");
        }
    }

    get token(): string | null {
        return this.jwt;
    }

    async submitVerificationCode(number: number): Promise<boolean> {
        const response = await this.api.account.verifyEmail({
            code: number,
            email: this.accountState.email,
        });
        if (response.ok) {
            this._accountState = response.data.accountInfo;
            return response.data.verified;
        }
        else {
            console.error("Failed to verify email", response);
            return false;
        }
    }

    async resendVerificationCode(): Promise<void> {
        await this.api.account.resendVerificationCode();
    }
}


const apiClient = new AccountServiceClient<never>({
    baseUrl: 'http://localhost:8086',
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
    headers.append("xivgear-csrf", "1");
    return fetch(params[0], {
        ...(params[1] ?? {}),
        credentials: 'include',
        headers: headers,
    });
}
