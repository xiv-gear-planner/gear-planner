import {FakeLocalStorage} from "@xivgear/core/util/fake_local_storage";

function isInIframe(): boolean {
    return window.self !== window.top;
}

/**
 * If running in an iframe, browser security settings for cross-origin pages might be tightly locked down.
 * Even attempting to access window.localStorage (without calling any methods on it) may throw an exception.
 */
function installReplacementsIfNeeded() {
    if (!isInIframe()) {
        return;
    }
    try {
        localStorage.getItem("test");
    }
    catch (e) {
        console.warn("localStorage is not available in iframe, using FakeLocalStorage", e);
        const fakeLocalStorage = new FakeLocalStorage();
        Object.defineProperty(window, 'localStorage', {
            get() {
                return fakeLocalStorage;
            },
        });
    }
    try {
        new BroadcastChannel("test").close();
    }
    catch (e) {
        console.warn("BroadcastChannel is not available in iframe, using FakeBroadcastChannel", e);
        const fakeBroadcastChannel = class FakeBroadcastChannel extends EventTarget {
            constructor(name: string) {
                super();
            }

            postMessage(message: unknown) {
            }

            close() {
            }
        } satisfies Omit<typeof window['BroadcastChannel'], 'prototype'>;
        Object.defineProperty(window, 'BroadcastChannel', {
            get() {
                return fakeBroadcastChannel;
            },
        });
    }
}

installReplacementsIfNeeded();
