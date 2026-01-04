import {XIVAPI_BASE_URL, XIVAPI_BASE_URL_FALLBACK} from "@xivgear/core/external/xivapi";

export function installImageFallbackHelper() {
    document.addEventListener('error', doImageFallback, {
        capture: true,
    });
}

function doImageFallback(event: ErrorEvent) {
    const image = event.target;
    if (image instanceof HTMLImageElement) {
        if (image.src?.includes(XIVAPI_BASE_URL))  {
            image.src = image.src.replaceAll(XIVAPI_BASE_URL, XIVAPI_BASE_URL_FALLBACK);
        }
        if (image.srcset?.includes(XIVAPI_BASE_URL)) {
            image.srcset = image.srcset.replaceAll(XIVAPI_BASE_URL, XIVAPI_BASE_URL_FALLBACK);
        }
    }
}

