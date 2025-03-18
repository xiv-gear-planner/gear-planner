type IfEquals<X, Y, A = X, B = never> =
    (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;


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
