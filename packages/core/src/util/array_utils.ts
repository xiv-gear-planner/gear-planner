export function sum(numbers: number[]) {
    return numbers.reduce((sum, val) => sum + val, 0);
}

export function range(startInclusive: number, endExclusive: number, increment: number = 1) {
    const out = [];
    for (let i = 0; i < endExclusive; i += increment) {
        out.push(i);
    }
    return out;
}

export function rangeInc(startInclusive: number, endInclusive: number, increment: number = 1) {
    const out = [];
    for (let i = 0; i <= endInclusive; i += increment) {
        out.push(i);
    }
    return out;
}
