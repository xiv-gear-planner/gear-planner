export function sum(numbers: number[]) {
    return numbers.reduce((sum, val) => sum + val, 0);
}

// TODO: these ignore startInclusive
export function range(startInclusive: number, endExclusive: number, increment: number = 1) {
    const out = [];
    for (let i = 0; i < endExclusive; i += increment) {
        out.push(i);
    }
    return out;
}

// TODO: these ignore startInclusive
export function rangeInc(startInclusive: number, endInclusive: number, increment: number = 1) {
    const out = [];
    for (let i = 0; i <= endInclusive; i += increment) {
        out.push(i);
    }
    return out;
}

/**
 * Determine if two arrays have equal members. Not a deep equals - only inspects one level.
 *
 * @param left The first array
 * @param right The second array
 */
export function arrayEq(left: unknown[] | undefined, right: unknown[] | undefined) {
    if (left === undefined && right === undefined) {
        return true;
    }
    if (left === undefined || right === undefined) {
        return false;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) {
            return false;
        }
    }
    return true;
}

