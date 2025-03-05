export type BuiltinType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'bigint'
    | 'symbol'
    | 'undefined'
    | 'object'
    | 'function';

export function requireType<T extends BuiltinType>(input: unknown, expected: T):
    T extends 'string' ? string :
        T extends 'number' ? number :
            T extends 'boolean' ? boolean :
                T extends 'bigint' ? bigint :
                    T extends 'symbol' ? symbol :
                        T extends 'undefined' ? undefined :
                            T extends 'object' ? object :
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                                T extends 'function' ? Function :
                                    never {
    const actualType = typeof input;
    if (actualType === expected) {
        return input as never;
    }
    else {
        throw Error(`Expected type ${expected}, got {} (value: [${input}]`);
    }
}

export function requireNumber(input: unknown) {
    return requireType(input, 'number');
}

export function requireString(input: unknown) {
    return requireType(input, 'string');
}

export function requireBool(input: unknown) {
    return requireType(input, 'boolean');
}

export function requireBoolish(input: unknown) {
    if (input === 0) {
        return false;
    }
    else if (input === 1) {
        return true;
    }
    else {
        return requireBool(input);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireArray(input: unknown): any[] {
    if (Array.isArray(input)) {
        return input;
    }
    else {
        throw Error(`Expected array, got ${input}`);
    }
}

export function requireArrayTyped<T extends BuiltinType>(input: unknown, memberType: T):
    T extends 'string' ? string[] :
        T extends 'number' ? number[] :
            T extends 'boolean' ? boolean[] :
                T extends 'bigint' ? bigint[] :
                    T extends 'symbol' ? symbol[] :
                        T extends 'undefined' ? undefined[] :
                            T extends 'object' ? object[] :
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                                T extends 'function' ? Function[] :
                                    never {
    const asArray = requireArray(input);
    const good = asArray.length === 0 || requireType(asArray[0], memberType);
    if (good) {
        // @ts-expect-error - idk
        return input;
    }
    else {
        throw Error(`Expected array to contain ${memberType}, got ${input}`);
    }
}
