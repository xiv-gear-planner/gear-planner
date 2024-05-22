export function sum(numbers: number[]) {
    return numbers.reduce((sum, val) => sum + val, 0);
}

export function range(startInclusive: number, endExclusive: number) {
    const out = [];
    for (let i = 0; i < endExclusive; i++) {
        out.push(i);
    }
    return out;
}

export function rangeInc(startInclusive: number, endInclusive: number) {
    const out = [];
    for (let i = 0; i <= endInclusive; i++) {
        out.push(i);
    }
    return out;
}
