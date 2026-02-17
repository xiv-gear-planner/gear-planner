import {CALC_HASH, HASH_QUERY_PARAM, PATH_SEPARATOR, splitPath} from "@xivgear/core/nav/common_nav";

import {formatTopMenu} from "./base_ui";
import {openMath} from "./mathpage/math_ui";
import {arrayEq} from "@xivgear/util/array_utils";
import {getQueryParams, manipulateUrlParams} from "@xivgear/common-ui/nav/common_frontend_nav";

let expectedHash: string[] | undefined = undefined;


/**
 * Process a potential change in hash.
 *
 * Note that unlike the old hash-based method, there is no catch-all listener for hash changes. Rather, anything
 * wishing to change the hash should use {@link goHash} to have the navigation automatically performed (if the
 * entire desired state can be determined from the path alone), or {@link setHash} if you wish to set the location
 * but manually replace the page contents.
 */
export async function processNav() {
    // Remove the literal #
    // let hash = splitHash(location.hash);
    const path = getQueryParams().get(HASH_QUERY_PARAM) ?? '';
    const pathParts = splitPath(path);
    formatTopMenu(pathParts);
    console.info("processQuery", pathParts);
    if (arrayEq(pathParts, expectedHash)) {
        console.info("Ignoring internal query change");
        return;
    }
    expectedHash = pathParts;
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
 * @param hashParts The path parts, e.g. for 'foo|bar', use ['foo', 'bar'] as the argument.
 */
export function setHash(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    expectedHash = [...hashParts];
    console.log("New hash parts", hashParts);
    const hash = hashParts.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, hash));
    formatTopMenu(expectedHash);
}

/**
 * Change the path of the current URL. Does not perform the actual navigation (i.e. the page contents will not be
 * changed). This will, however, update the state of the top menu - that is, if you navigate to the 'new sheet' page,
 * then the 'New Sheet' button will be active.
 *
 * This method is useful for when the entire page state can be determined from the path alone, and you don't need to
 * override any behavior.
 *
 * @param hashParts The path parts, e.g. for 'foo|bar', use ['foo', 'bar'] as the argument.
 */
export function goHash(...hashParts: string[]) {
    for (const hashPart of hashParts) {
        if (hashPart === undefined) {
            console.error(new Error("Undefined url hash part!"), hashParts);
            return;
        }
    }
    const hash = hashParts.map(part => encodeURIComponent(part)).join(PATH_SEPARATOR);
    manipulateUrlParams(params => params.set(HASH_QUERY_PARAM, hash));
    processNav();
}
