// TODO: most of these don't need to be in frontend
type IfEquals<X, Y, A = X, B = never> =
    (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

/**
 * Type representing only the writable keys of T
 */
export type WritableKeys<T> = {
    [K in keyof T]-?: IfEquals<{
        [Q in K]: T[K];
    }, {
        -readonly [Q in K]: T[K];
    }, K, never>
}[keyof T];

/**
 * Type representing the writable properties of T
 */
export type WritableProps<T> = Pick<T, WritableKeys<T>>;

export type WritableCssProp = {
    [K in keyof CSSStyleDeclaration as IfEquals<{ [P in K]: CSSStyleDeclaration[P] },
        { -readonly [P in K]: CSSStyleDeclaration[P] },
        K> extends never ? never : K]: CSSStyleDeclaration[K] extends string ? K : never;
}[keyof CSSStyleDeclaration];

export type StyleSwitcher = Record<string, {
    [K in WritableCssProp]?: string;
}>;

export type XivApiIcon = {
    id: number,
    path: string,
    path_hr1: string,
}

/**
 * Type representing T, but with K properties being required instead of optional.
 */
export type RequireProps<T, K extends keyof T> = T & {
    [P in K]-?: T[P];
};
