// https://stackoverflow.com/a/39718708
export function camel2title(camelCase: string): string {
    return camelCase
        .replace(/([A-Z])/g, (match) => ` ${match}`)
        .replace(/^./, (match) => match.toUpperCase())
        .trim();
}