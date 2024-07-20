// https://stackoverflow.com/a/39718708
export function camel2title(camelCase: string): string {
    if (camelCase.includes(' ')) {
        return camelCase;
    }
    return camelCase
        .replace(/([A-Z])/g, (match) => ` ${match}`)
        .replace(/^./, (match) => match.toUpperCase())
        .trim();
}

export function toRelPct(input: number, decimalPlaces: number) {
    return `${input > 0 ? '+' : ''}${(input * 100).toFixed(decimalPlaces)}`;
}

export function formatDuration(duration: number): string {
    const seconds = duration % 60;
    const secondsStr = `${seconds < 10 ? "0" : ""}${seconds.toFixed(3)}`;

    const minutes = Math.floor(duration / 60);
    const minutesStr = `${minutes < 10 ? "0" : ""}${minutes}`;

    return `${minutesStr}:${secondsStr}`;
}

export function shortenItemName(itemName: string): string {
    return itemName.replace("Augmented", "Aug.");
}

export function capitalizeFirstLetter(value: string): string {
    if (typeof value === 'string' && value.length >= 1) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
}