export function writeProxy<X extends object>(obj: X, action: () => void): X {
    return new Proxy<X>(obj, {
        set(target, prop, value, receiver) {
            target[prop] = value;
            action();
            return true;
        },
    });
}
