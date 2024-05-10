
export type ValueWithDev = {
    'expected': number,
    'stdDev': number
}

export function addValues(...values: ValueWithDev[]): ValueWithDev {
    let sum = 0;
    let varianceSum = 0;
    for (let value of values) {
        sum += value.expected;
        varianceSum += value.stdDev ** 2
    }
    const stdDev = Math.sqrt(varianceSum);
    return {
        expected: sum,
        stdDev: stdDev
    }
}

export function multiplyValues(...values: ValueWithDev[]): ValueWithDev {
    let product = 1;
    // Var(x1...xn) = (prod i=1..n of (dev_i^2 + mean_i^2)) - (prod i=1..n of (dev_i^2)
    //                 ^ first term                            ^ second term
    let firstTerm = 1;
    let secondTerm = 1;
    for (let value of values) {
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

export function multiplyFixed(value: ValueWithDev, scalar: number) {
    return multiplyValues(value, fixedValue(scalar));
}

export function chanceMultiplierStdDev(chance: number, multiplier: number): ValueWithDev {
    const expected = chance * (multiplier - 1) + 1;
    const stdDev = Math.sqrt(chance * (1 - chance)) * (multiplier - 1);
    return {
        expected: expected,
        stdDev: stdDev
    }
}

export function fixedValue(value: number): ValueWithDev {
    return {
        expected: value,
        stdDev: 0
    }
}