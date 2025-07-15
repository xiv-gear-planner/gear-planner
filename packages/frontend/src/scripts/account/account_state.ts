import {
    AccountInfo,
    AccountServiceClient,
    ChangePasswordResponse,
    RegisterResponse,
    ValidationErrorResponse
} from "@xivgear/account-service-client/accountsvc";
import {recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {RefreshLoop} from "@xivgear/util/refreshloop";
import {PromiseHelper} from "@xivgear/util/async";


// TODO: since api client is no longer configured to throw on bad response, need to manually check all of them
export class AccountStateTracker {

    private readonly refreshLoop: RefreshLoop;
    private _lastAccountState: AccountInfo | null = null;
    private _accountState: AccountInfo | null = null;
    private jwt: string | null = null;
    private _listeners: AccountStateListener[] = [];
    private checkedOnce: boolean = false;

    private _stateHelper = new PromiseHelper<AccountInfo | null>();
    private _tokenHelper = new PromiseHelper<string | null>();
    private _verifiedTokenHelper = new PromiseHelper<string | null>();

    constructor(private readonly api: AccountServiceClient<never>) {
        this.refreshLoop = new RefreshLoop(async () => this.refresh(), () => {
            if (this.definitelyNotLoggedIn) {
                // If we know we are definitely not logged in, refresh once an hour
                return 1000 * 60 * 60;
            }
            // Otherwise, refresh once every 5 minutes (15 min JWT expiration)
            return 1000 * 60 * 5;
        });
        this.addAccountStateListener((tracker, stateNow, stateAfter) => {
            this._stateHelper.provideValue(stateNow);
            if (stateNow !== null) {
                if (tracker.token !== null) {
                    this._tokenHelper.provideValue(tracker.token);
                    if (tracker.accountState?.verified) {
                        this._verifiedTokenHelper.provideValue(tracker.token);
                    }
                    else {
                        this._verifiedTokenHelper.provideValue(null);
                    }
                }
            }
            else {
                this._tokenHelper.provideValue(null);
                this._verifiedTokenHelper.provideValue(null);
            }
        });
    }

    private notifyListeners(): void {
        for (const listener of this._listeners) {
            try {
                listener(this, this._accountState, this._lastAccountState);
            }
            catch (e) {
                console.error("Error notifying listener", e);
            }
        }
        this._lastAccountState = this._accountState;
    }

    private ingestAccountState(accountState: AccountInfo): void {
        this._accountState = accountState;
        this.checkedOnce = true;
        this.notifyListeners();
    }

    private get definitelyNotLoggedIn(): boolean {
        return !this.loggedIn && this.checkedOnce;
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
                this.ingestAccountState(info);
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
        this.jwt = null;
        this.ingestAccountState(null);
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
            this.ingestAccountState(data.accountInfo ?? null);
            this.notifyListeners();
            return this._accountState;
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
            this.notifyListeners();
            return jwt;
        }
        else if (resp.status === 401) {
            this.jwt = null;
            this.notifyListeners();
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
        this.notifyListeners();
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

    get verifiedToken(): string | null {
        if (this.accountState?.verified) {
            return this.token;
        }
        return null;
    }

    get hasVerifiedToken(): boolean {
        return this.verifiedToken !== null;
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
            this.ingestAccountState(response.data.accountInfo);
            recordEvent('verifyEmailSuccess');
            return response.data.verified;
        }
        else {
            console.error("Failed to verify email", response);
            recordEvent('verifyEmailFailure');
            this.notifyListeners();
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

    /**
     * Change password
     *
     * @param existingPassword
     * @param newPassword
     */
    async changePassword(existingPassword: string, newPassword: string): Promise<ChangePasswordResponse | ValidationErrorResponse> {
        recordEvent('changePasswordAttempt');
        const resp = await this.api.account.changePassword({
            existingPassword,
            newPassword,
        });
        if (resp.ok) {
            return resp.data;
        }
        else {
            return resp.error;
        }
    }

    addAccountStateListener(listener: AccountStateListener): void {
        this._listeners.push(listener);
    }

    /**
     * Returns a promise that resolves to the most recent AccountInfo (or null if not logged in). Does not resolve
     * until at least one attempt to check account info has been made.
     */
    get statePromise(): Promise<AccountInfo | null> {
        return this._stateHelper.promise;
    }

    /**
     * Returns a promise that resolves to the most recent token (or null if not logged in). Does not resolve
     * until at least one attempt to retrieve a JWT token has been made, or if we know that we are not logged in.
     */
    get tokenPromise(): Promise<string | null> {
        return this._tokenHelper.promise;
    }

    /**
     * Like {@link #tokenPromise}, but resolves to null if we have a token without the 'verified' role (i.e. can't
     * do anything with it other than verifying account).
     */
    get verifiedTokenPromise(): Promise<string | null> {
        return this._verifiedTokenHelper.promise;
    }
}

export type AccountStateListener = (tracker: AccountStateTracker, stateNow: AccountInfo | null, stateAfter: AccountInfo | null) => void;


const accountApiClient = new AccountServiceClient<never>({
    baseUrl: document.location.hostname === 'localhost' ? 'http://localhost:8086' : 'https://accountsvc.xivgear.app',
    // baseUrl: 'http://192.168.1.119:8086',
    customFetch: cookieFetch,
});

export const ACCOUNT_STATE_TRACKER = new AccountStateTracker(accountApiClient);

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        accStateTracker?: AccountStateTracker;
    }
}
window.accStateTracker = ACCOUNT_STATE_TRACKER;

export async function cookieFetch(...params: Parameters<typeof fetch>): Promise<Response> {
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
