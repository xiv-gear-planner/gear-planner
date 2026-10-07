import {
    CALC_HASH,
    getUrlNavigationPath,
    HASH_QUERY_PARAM,
    makeUrlPath
} from "@xivgear/core/nav/common_nav";

import {formatTopMenu} from "./base_ui";
import {openMath} from "./mathpage/math_ui";
import {arrayEq} from "@xivgear/util/array_utils";
import {cleanUrlParams, getQueryParams} from "@xivgear/common-ui/nav/common_frontend_nav";

let expectedPath: string[] | undefined = undefined;


/**
 * Process a potential change in the URL path.
 *
 * Note that navigation uses slash-delimited URL paths. Code wishing to navigate should use {@link goPath} to have the
 * navigation automatically performed (if the entire desired state can be determined from the path alone), or
 * {@link setPath} if you wish to set the location but manually replace the page contents.
 */
export async function processNav() {
    // Rewrite %7C to | in-place for older links that encoded the legacy page parameter.
    window.history.replaceState(null, "", cleanUrlParams(document.location.search));
    const qp = getQueryParams();
    const legacyPath = qp.get(HASH_QUERY_PARAM);
    const pathParts = getUrlNavigationPath(location.pathname, legacyPath);
    // Keep old ?page= links working while moving them to the canonical pathname.
    if (legacyPath !== null && pathParts.length > 0) {
        const canonicalUrl = new URL(location.href);
        canonicalUrl.pathname = makeUrlPath(pathParts);
        canonicalUrl.searchParams.delete(HASH_QUERY_PARAM);
        canonicalUrl.hash = '';
        window.history.replaceState(null, '', canonicalUrl);
    }
    formatTopMenu(pathParts);
    console.info("processPath", pathParts);
    if (arrayEq(pathParts, expectedPath)) {
        console.info("Ignoring internal path change");
        return;
    }
    expectedPath = pathParts;
    await doNav(pathParts);
}

export type NavPath = {
    type: 'math',
    formula: string | null
};

export function parsePath(originalPath: string[]): NavPath | null {
    const path = [...originalPath];
    if (path.length === 0) {
        return {
            type: 'math',
            formula: null,
        };
    }
    const mainNav = path[0];

    if (mainNav === CALC_HASH) {
        return {
            type: 'math',
            formula: path.length >= 2 ? path[1] : null,
        };
    }
    console.log('Unknown nav path', path);
    return null;
}

async function doNav(pathParts: string[]) {
    const nav = parsePath(pathParts);
    if (nav !== null) {
        switch (nav.type) {
            case "math": {
                openMath(nav.formula);
                return;
            }
        }
    }
    console.error("I don't know what to do with this path", pathParts);
    // TODO: handle remaining invalid cases
}

/**
 * Change the path of the current URL. Does not perform the actual navigation (i.e. the page contents will not be
 * changed). This will, however, update the state of the top menu - that is, if you navigate to the 'new sheet' page,
 * then the 'New Sheet' button will be active.
 *
 * As such, this method should be used when you plan to change the contents of the page yourself, which is necessary
 * for some paths. For example, when importing a sheet, the 'imported' path does not contain the actual sheet data
 * nor anything that would lead to it, so it must use this method.
 *
 * @param pathParts The path parts, e.g. for '/foo/bar', use ['foo', 'bar'] as the argument.
 */
export function setPath(...pathParts: string[]) {
    for (const pathPart of pathParts) {
        if (pathPart === undefined) {
            console.error(new Error("Undefined url path part!"), pathParts);
            return;
        }
    }
    expectedPath = [...pathParts];
    console.log("New path parts", pathParts);
    setUrlPath(pathParts);
    formatTopMenu(expectedPath);
}

/**
 * Change the path of the current URL. Does not perform the actual navigation (i.e. the page contents will not be
 * changed). This will, however, update the state of the top menu - that is, if you navigate to the 'new sheet' page,
 * then the 'New Sheet' button will be active.
 *
 * This method is useful for when the entire page state can be determined from the path alone, and you don't need to
 * override any behavior.
 *
 * @param pathParts The path parts, e.g. for '/foo/bar', use ['foo', 'bar'] as the argument.
 */
export function goPath(...pathParts: string[]) {
    for (const pathPart of pathParts) {
        if (pathPart === undefined) {
            console.error(new Error("Undefined url path part!"), pathParts);
            return;
        }
    }
    setUrlPath(pathParts);
    processNav();
}

/** @deprecated Use {@link setPath}. */
export function setHash(...pathParts: string[]) {
    setPath(...pathParts);
}

/** @deprecated Use {@link goPath}. */
export function goHash(...pathParts: string[]) {
    goPath(...pathParts);
}

/** Update the URL to a canonical slash-delimited path while preserving other query parameters. */
function setUrlPath(pathParts: string[]) {
    const url = new URL(location.href);
    url.pathname = makeUrlPath(pathParts);
    url.searchParams.delete(HASH_QUERY_PARAM);
    url.hash = '';
    history.pushState(null, '', url);
}
