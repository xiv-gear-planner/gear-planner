
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
    let variancePart = 0;
    for (let value of values) {
        product *= value.expected;
        variancePart += (value.stdDev / value.expected) ** 2;
    }
    const stdDev = Math.sqrt(variancePart * (product ** 2));
    return {
        expected: product,
        stdDev: stdDev
    }
}