import {AccountInfo, AccountServiceClient} from "@xivgear/account-service-client/accountsvc";

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

export class AccountStateTracker {

    private readonly refreshLoop: RefreshLoop;
    private _accountState: AccountInfo | null = null;
    private jwt: string | null = null;

    constructor(private readonly api: AccountServiceClient<never>) {
        this.refreshLoop = new RefreshLoop(() => this.refresh(), 1000 * 60 * 5);
    }

    async init(): Promise<void> {
        this.refreshLoop.start();
    }

    async refresh(): Promise<void> {
        await this.refreshInfo();
        await this.refreshToken();
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

    async refreshInfo(): Promise<AccountInfo | null> {
        const resp = await this.api.account.accountInfo();
        if (resp.ok) {
            const accInfo = resp.data;
            this._accountState = accInfo;
            return accInfo;
        }
        else if (resp.status === 401) {
            return null;
        }
        else {
            console.error("Unknown login failure", resp);
            throw new Error(`Login failure: ${resp.status} ${resp.statusText}`);
        }
    }

    async refreshToken(): Promise<string> {
        const resp = await this.api.account.getJwt();
        if (resp.ok) {
            const jwt = resp.data.token;
            this.jwt = jwt;
            return jwt;
        }
        else if (resp.status === 401) {
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
    return fetch(params[0], {
        ...(params[1] ?? {}),
        credentials: 'include',
    });
}
