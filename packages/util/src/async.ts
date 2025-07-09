export type ResolveReject<T> = {
    resolve: (res: T) => void,
    reject: (rej: unknown) => void,
}

/**
 * Helper for a design pattern where we have some value which is populated asynchronously, but we might update the
 * value after receiving an initial value. For example, we use the account service to retrieve a JWT token. A consumer
 * just wants a valid token - so they want to wait for the initial token retrieval, but they also don't want to be
 * locked in to a stale token.
 *
 * When getting .promise, it will return either a promise that waits for the initial value, or immediately resolves
 * to the most recently seen value.
 */
export class PromiseHelper<T> {

    private _promise: Promise<T>;
    private _pending!: ResolveReject<T> | null;

    constructor() {
        this._promise = new Promise((resolve, reject) => {
            this._pending = {
                resolve,
                reject,
            };
        });
    }

    get promise(): Promise<T> {
        return this._promise;
    }

    provideValue(value: T) {
        if (this._pending !== null) {
            this._pending.resolve(value);
            this._pending = null;
        }
        this._promise = Promise.resolve(value);
    }
}
