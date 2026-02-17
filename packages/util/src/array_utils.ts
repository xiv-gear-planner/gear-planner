export function sum(numbers: number[]) {
    return numbers.reduce((sum, val) => sum + val, 0);
}

/**
 * Range produces a range of numbers starting with startInclusive and ending before endExclusive.
 *
 * If startInclusive is greater than endExclusive, or increment is not positive, the behavior of this function
 * is undefined.
 *
 * @param startInclusive
 * @param endExclusive
 * @param increment defaults to 1
 */
export function range(startInclusive: number, endExclusive: number, increment: number = 1): number[] {
    const out = [];
    for (let i = startInclusive; i < endExclusive; i += increment) {
        out.push(i);
    }
    return out;
}

/**
 * Range produces a range of numbers starting with startInclusive and ending with endExclusive (assuming it would
 * have been included in the range based on startInclusive and endInclusive.
 *
 * If startInclusive is greater than endInclusive, or increment is not positive, the behavior of this function
 * is undefined.
 *
 * @param startInclusive
 * @param endInclusive
 * @param increment defaults to 1
 */
export function rangeInc(startInclusive: number, endInclusive: number, increment: number = 1): number[] {
    const out = [];
    for (let i = startInclusive; i <= endInclusive; i += increment) {
        out.push(i);
    }
    return out;
}

/**
 * Determine if two arrays have equal members. Not a deep equals - only inspects one level.
 *
 * null and undefined are both acceptable inputs, but are not considered equal to each other, nor are they equivalent
 * to an empty array.
 *
 * @param left The first array
 * @param right The second array
 */
export function arrayEq(left: unknown[] | undefined | null, right: unknown[] | undefined | null) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
        return left === right;
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

export function arrayEqTyped<X>(left: X[] | undefined, right: X[] | undefined): boolean {
    return arrayEq(left, right);
}
