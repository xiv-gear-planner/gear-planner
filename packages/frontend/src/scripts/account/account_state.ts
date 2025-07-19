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
import {ConfirmAccountChangeModal} from "./components/confirm_account_change_modal";

const LAST_UID_KEY = 'lastLoggedInUid';

export type PurgeLocalDataBroadcast = {
    type: 'purgeLocalData',
}

// Does not carry data - other windows should reload the data on their own
export type AccountInfoChangeBroadcast = {
    type: 'accountInfoChange',
}

type AccountStateBroadcast = PurgeLocalDataBroadcast | AccountInfoChangeBroadcast;

// TODO: since api client is no longer configured to throw on bad response, need to manually check all of them
export class AccountStateTracker {

    private readonly refreshLoop: RefreshLoop;
    private _lastAccountState: AccountInfo | null = null;
    private _accountState: AccountInfo | null = null;
    private _jwt: string | null = null;
    private _lastTokenState: TokenState | null = null;
    private _accountListeners: AccountStateListener[] = [];
    private _tokenListeners: TokenStateListener[] = [];
    private checkedOnce: boolean = false;

    private _stateHelper = new PromiseHelper<AccountInfo | null>();
    private _tokenHelper = new PromiseHelper<string | null>();
    private _verifiedTokenHelper = new PromiseHelper<string | null>();

    constructor(private readonly api: AccountServiceClient<never>,
                private readonly storage: Storage,
                private readonly broadcastChannel: BroadcastChannel,
                private readonly accountChangeConfirmation: () => Promise<boolean>
    ) {
        this.refreshLoop = new RefreshLoop(async () => this.refresh(), () => {
            if (this.definitelyNotLoggedIn) {
                // If we know we are definitely not logged in, refresh once an hour
                return 1000 * 60 * 60;
            }
            // Otherwise, refresh once every 5 minutes (15 min JWT expiration)
            return 1000 * 60 * 5;
        });
        this.addAccountStateListener((tracker, stateNow, stateBefore) => {
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
        this.addAccountStateListener((_, after, before) => {
            if ((after && !before) || (!after && before)) {
                this.postBroadcastMessage({
                    type: 'accountInfoChange',
                });
            }
        });
        broadcastChannel.onmessage = (ev) => {
            const msg = ev.data as AccountStateBroadcast;
            console.log("Got broadcast message", msg);
            if (msg.type === 'purgeLocalData') {
                this.afterPurge();
            }
            else if (msg.type === 'accountInfoChange') {
                this.refreshLoop.refresh();
            }
        };
    }

    private postBroadcastMessage(msg: AccountStateBroadcast): void {
        console.log("Posting broadcast message", msg);
        this.broadcastChannel.postMessage(msg);
    }

    private notifyListeners(): void {
        for (const listener of this._accountListeners) {
            try {
                listener(this, this._accountState, this._lastAccountState);
            }
            catch (e) {
                console.error("Error notifying listener", e);
            }
        }
        this._lastAccountState = this._accountState;
    }

    private notifyTokenListeners(): void {
        const newTokenState: TokenState = {
            token: this.jwt,
            verified: this.hasVerifiedToken,
        };
        for (const listener of this._tokenListeners) {
            try {
                listener(this._lastTokenState, newTokenState);
            }
            catch (e) {
                console.error("Error notifying listener", e);
            }
        }
        this._lastTokenState = newTokenState;
    }

    private async ingestAccountState(accountState: AccountInfo): Promise<void> {
        const lastUid = this.lastUid;
        const newUid = accountState?.uid;
        console.log(`Old: ${lastUid}, new: ${newUid}`);
        if (lastUid && newUid) {
            if (newUid !== lastUid) {
                // If we are in the state where we have logged in with a different account, but have not yet decided
                // whether to purge or cancel, we need to prevent the token and account state from being used.
                this._accountState = null;
                this._jwt = null;
                // Warn that the user is logging in with a different account
                const result: boolean = await this.confirmAccountChange();
                if (result) {
                    this.purgeLocalData();
                    // Don't need to do anything past this - this forces a refresh
                    return;
                }
                else {
                    await this.logout(false);
                    this.checkedOnce = true;
                    this.notifyListeners();
                    return;
                }
            }
        }
        if (newUid) {
            // We don't want to blank out last-UID if logging out, that defeats the purpose of tracking it,
            // which is to require clearing data if you log in with a different account.
            this.lastUid = newUid;
        }
        this._accountState = accountState;
        this.checkedOnce = true;
        this.notifyListeners();
        return;
    }

    get jwt(): string | null {
        return this._jwt;
    }

    set jwt(value: string | null) {
        this._jwt = value;
        this.notifyTokenListeners();
    }

    private get lastUid(): number | null {
        const lastUid = parseInt(this.storage.getItem(LAST_UID_KEY));
        if (lastUid && typeof lastUid === 'number') {
            return lastUid;
        }
        return null;
    }

    private set lastUid(uid: number | null) {
        if (uid === null) {
            this.storage.removeItem(LAST_UID_KEY);
        }
        else {
            this.storage.setItem(LAST_UID_KEY, JSON.stringify(uid));
        }
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
                await this.ingestAccountState(info);
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
    async logout(clearData: boolean = false): Promise<void> {
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
        await this.ingestAccountState(null);
        if (clearData) {
            this.purgeLocalData();
        }
    }

    // Purge local data then reload
    purgeLocalData(): void {
        this.postBroadcastMessage({
            type: 'purgeLocalData',
        });
        this.storage.clear();
        this.afterPurge();
    }

    // Called after clearing local data, or when such happened in another window
    afterPurge(): void {
        location.reload();
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
            await this.ingestAccountState(data.accountInfo ?? null);
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
        this.refreshLoop.refresh();
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
            throw Error(`${promise.status} ${promise.statusText}`);
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
            await this.ingestAccountState(response.data.accountInfo);
            recordEvent('verifyEmailSuccess');
            this.refreshLoop.refresh();
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
        this._accountListeners.push(listener);
    }

    addTokenListener(listener: TokenStateListener): void {
        this._tokenListeners.push(listener);
    }

    // noinspection JSUnusedGlobalSymbols
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

    /**
     * Ask the user to confirm that they want to switch accounts which entails clearing local data.
     *
     * @private
     */
    private async confirmAccountChange(): Promise<boolean> {
        return await this.accountChangeConfirmation();
    }
}

// TODO: combine these in the future
export type AccountStateListener = (tracker: AccountStateTracker, stateNow: AccountInfo | null, stateBefore: AccountInfo | null) => void;
export type TokenState = {
    token: string | null,
    verified: boolean,
}
export type TokenStateListener = (before: TokenState | null, after: TokenState) => void;


const accountApiClient = new AccountServiceClient<never>({
    baseUrl: document.location.hostname === 'localhost' ? 'http://localhost:8086' : 'https://accountsvc.xivgear.app',
    // baseUrl: 'http://192.168.1.119:8086',
    customFetch: cookieFetch,
});

async function confirmAccountChange(): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
        new ConfirmAccountChangeModal({
            resolve,
            reject,
        }).attachAndShowTop();
    });
}

export const ACCOUNT_STATE_BROADCAST_CHANNEL = new BroadcastChannel("account-state");
export const ACCOUNT_STATE_TRACKER = new AccountStateTracker(accountApiClient, localStorage, ACCOUNT_STATE_BROADCAST_CHANNEL, confirmAccountChange);

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
