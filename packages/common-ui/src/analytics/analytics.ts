import {toSerializableForm} from "@xivgear/util/proxies";

export type ExtraData = {
    [key: string]: unknown
}

type UnknownFn = (...args: readonly unknown[]) => unknown;

/**
 * Since we don't care about the return value of any umami methods, we can
 * make it type safe by just re-typing all methods to return 'unknown'.
 */
type MethodsReturnUnknown<T> = {
    [K in keyof T]:
    T[K] extends UnknownFn
        ? (...args: Parameters<T[K]>) => unknown
        : T[K];
};

type SafeUmami = MethodsReturnUnknown<umami.umami>;

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        umami: SafeUmami;
    }
}

type QueuedAction = {
    method: keyof umami.umami,
    args: unknown[];
}

let actionQueue: QueuedAction[] | null = [];

function flushQueue(umami: umami.umami) {
    if (actionQueue) {
        const queue = actionQueue;
        actionQueue = null;
        queue.forEach(action => {
            try {
                // @ts-expect-error This is a proxy
                umami[action.method](...action.args);
            }
            catch (e) {
                console.error(`Error flushing analytics action ${action.method}`, e);
            }
        });
    }
}

const queueProxy = new Proxy({} as umami.umami, {
    get(target, prop: keyof umami.umami) {
        return (...args: unknown[]) => {
            actionQueue?.push({
                method: prop,
                args,
            });
        };
    },
});

let umamiValue: umami.umami = window.umami ?? queueProxy;

if (!window.umami) {
    console.info("umami not yet loaded - using queue");
    try {
        Object.defineProperty(window, 'umami', {
            get() {
                return umamiValue;
            },
            set(val: umami.umami) {
                if (val && val !== queueProxy) {
                    console.info("got real umami");
                    umamiValue = val;
                    flushQueue(val);
                }
            },
            configurable: true,
            enumerable: true,
        });
    }
    catch (e) {
        console.warn("Could not define property on window.umami, events might not be buffered properly until next event call.", e);
    }
}
else {
    console.info("umami already loaded - no queue needed");
}

// If it was already set but not to our proxy, flush it.
if (window.umami && window.umami !== queueProxy) {
    flushQueue(window.umami);
}

export function recordEvent(name: string, data?: ExtraData) {
    try {
        window.umami.track(name, data);
    }
    catch (e) {
        console.error("Error recording analytics", e);
    }
}

export function recordError(where: string, error: unknown, extraProps: object = {}) {
    const umami = window.umami;
    try {
        if (error instanceof Error) {
            const eventData = {
                ...toSerializableForm(error),
                ...extraProps,
                where: where,
            };
            umami.track("error", eventData);
        }
        else if (error instanceof Object) {
            const eventData = {
                ...error,
                ...extraProps,
                where: where,
            };
            umami.track("error", eventData);
        }
        else {
            const eventData = {
                stringData: `${where}: ${String(error)}`,
                ...extraProps,
                where: where,
            };
            umami.track("error", eventData);
        }
    }
    catch (e) {
        try {
            recordEvent("errorLoggingError", {msg: String(e)});
        }
        catch (e) {
            // ignored
        }
        console.error("error logging error", e);
    }
}

try {
    window.addEventListener('unhandledrejection', e => {
        recordError("unhandledRejection", String(e.reason));
    });
}
catch (e) {
    // Likely, browser does not support this
    console.warn("Could not install unhandled promise tracker", e);
}

// Defer the umami script as much as possible
setTimeout(() => {
    console.info("Starting async umami load");
    // <script async src="https://um.xivgear.app/umami" data-website-id="bc3fc7a6-b0ac-4a30-b737-031b59a9810f"></script>
    const umamiScript = document.createElement('script');
    umamiScript.src = "https://um.xivgear.app/umami";
    umamiScript.setAttribute("data-website-id", "bc3fc7a6-b0ac-4a30-b737-031b59a9810f");
    umamiScript.fetchPriority = 'low';
    umamiScript.addEventListener('load', () => {
        console.info("umami async loaded");
    });
    umamiScript.addEventListener('error', e => {
        console.error("error async loading umami", e);
    });
    document.head.appendChild(umamiScript);
}, 1_000);
