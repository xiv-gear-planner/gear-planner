import {toSerializableForm} from "@xivgear/util/proxies";

export type ExtraData = {
    [key: string]: unknown
}

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        umami?: umami.umami;
    }
}

export function recordEvent(name: string, data?: ExtraData) {
    try {
        const umami = window.umami;
        // Don't blindly expect this to exist - someone might block the script with an adblocker, and we don't want
        // the rest of the site to blow up. It also might just be down.
        umami?.track(name, data);
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
            umami?.track("error", eventData);
        }
        else if (error instanceof Object) {
            const eventData = {
                ...error,
                ...extraProps,
                where: where,
            };
            umami?.track("error", eventData);
        }
        else {
            const eventData = {
                stringData: `${where}: ${String(error)}`,
                ...extraProps,
                where: where,
            };
            umami?.track("error", eventData);
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
