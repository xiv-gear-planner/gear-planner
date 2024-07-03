/**
 * Type representing a value with variance.
 */
export type ValueWithDev = {
    'expected': number,
    'stdDev': number
}

/**
 * Add multiple values with variance.
 *
 * @param values The values to add
 */
export function addValues(...values: ValueWithDev[]): ValueWithDev {
    let sum = 0;
    let varianceSum = 0;
    for (const value of values) {
        sum += value.expected;
        varianceSum += value.stdDev ** 2
    }
    const stdDev = Math.sqrt(varianceSum);
    return {
        expected: sum,
        stdDev: stdDev
    }
}

/**
 * Multiply values with variance.
 *
 * @param values The values to multiply.
 */
export function multiplyValues(...values: ValueWithDev[]): ValueWithDev {
    let product = 1;
    // Var(x1...xn) = (prod i=1..n of (dev_i^2 + mean_i^2)) - (prod i=1..n of (dev_i^2)
    //                 ^ first term                            ^ second term
    let firstTerm = 1;
    let secondTerm = 1;
    for (const value of values) {
        product *= value.expected;
        firstTerm *= value.expected ** 2 + value.stdDev ** 2;
        secondTerm *= value.expected ** 2;
    }
    const stdDev = Math.sqrt(firstTerm - secondTerm);
    return {
        expected: product,
        stdDev: stdDev
    }
}

/**
 * Multiply a value with variance with a simple scalar value with no variance.
 *
 * @param value The value with variance.
 * @param scalar The value with no variance.
 */
export function multiplyFixed(value: ValueWithDev, scalar: number) {
    return multiplyValues(value, fixedValue(scalar));
}

/**
 * Multiply a value with variance by a scalar with no variance, rolling the random
 * variable independently each time.
 *
 * i.e. sum i=1..k (X_i) rather than kX
 *
 * @param value The value with variance.
 * @param scalar The value with no variance.
 */
export function multiplyIndependent(value: ValueWithDev, scalar: number) {
    // Calling addValues can give the same result but is probably cleaner to do this way
    return {
        expected: value.expected * scalar,
        // variance = k * dev**2 -> stddev = sqrt(variance)
        stdDev: Math.sqrt(Math.abs(scalar)) * value.stdDev
    }
}

/**
 * Produce the expected value and std dev for a given chance + multiplier.
 *
 * It is assumed that if the roll succeeds, then the value is equal to the multiplier,
 * while if the roll fails, the value is equal to 1.
 *
 * @param chance The chance for the roll to succeed.
 * @param multiplier The multiplier if the roll fails.
 */
export function chanceMultiplierStdDev(chance: number, multiplier: number): ValueWithDev {
    const expected = chance * (multiplier - 1) + 1;
    const stdDev = Math.sqrt(chance * (1 - chance)) * (multiplier - 1);
    return {
        expected: expected,
        stdDev: stdDev
    }
}

/**
 * Produce a {@link ValueWithDev} that represents a fixed value with no variance.
 *
 * @param value The fixed value.
 */
export function fixedValue(value: number): ValueWithDev {
    return {
        expected: value,
        stdDev: 0
    }
}

/**
 * Calculate a value +/- a number of standard deviations.
 *
 * @param value The value.
 * @param stdDeviations The number of standard deviations to add.
 */
export function applyStdDev(value: ValueWithDev, stdDeviations: number) {
    return value.expected + stdDeviations * value.stdDev;
}