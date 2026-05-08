import {FakeLocalStorage} from "@xivgear/core/util/fake_local_storage";

function isInIframe(): boolean {
    return window.self !== window.top;
}

function checkIframeLocalStorage() {
    if (isInIframe()) {
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
    }
}

checkIframeLocalStorage();
