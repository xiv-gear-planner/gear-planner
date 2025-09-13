
export function cleanUrlParams(url: string): string {
    return url.replaceAll("%7C", "|");
}

export function cleanUrl(url: URL): URL {
    const cloned = new URL(url);
    cloned.search = cleanUrlParams(cloned.search);
    return cloned;
}

/**
 * Get the query params of the current page.
 */
export function getQueryParams(): URLSearchParams {
    return new URLSearchParams(location.search);
}

/**
 * Apply a function to the current URL query parameters, then push the modified parameters onto the history.
 * This does not perform navigation on its own. This function is rarely called on its own.
 *
 * @param action The modifications to apply.
 */
export function manipulateUrlParams(action: (params: URLSearchParams) => void) {
    const params = getQueryParams();
    const before = cleanUrlParams(params.toString());
    action(params);
    const after = cleanUrlParams(params.toString());
    if (before !== after) {
        history.pushState(null, "", '?' + after);
    }
}
