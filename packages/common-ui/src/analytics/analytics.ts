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

export function recordError(where: string, error: unknown) {
    if (error instanceof Error) {
        const eventData = {
            ...toSerializableForm(error),
            where: where,
        };
        umami.track("error", eventData);
    }
    else if (error instanceof Object) {
        const eventData = {
            ...error,
            where: where,
        };
        umami.track("error", eventData);
    }
    else {
        const eventData = {
            stringData: String(error),
            where: where,
        };
        umami.track("error", eventData);
    }
}