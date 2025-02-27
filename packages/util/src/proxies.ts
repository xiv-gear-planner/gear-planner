export function writeProxy<X extends object>(obj: X, action: () => void): X {
    return new Proxy<X>(obj, {
        set(target: X, prop: string | symbol, value: unknown, receiver) {
            // @ts-expect-error we do not know the type beforehand
            target[prop] = value;
            action();
            return true;
        },
    });
}
