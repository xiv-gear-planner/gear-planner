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

/**
 * Given an object, turn it into a proxy that will also consider getters to be real properties
 *
 * @param obj the object to wrap
 */
export function toSerializableForm<X extends object>(obj: X): X {
    return new Proxy(obj, {
        get(target, prop, receiver) {
            // Check if the property is a getter on the prototype chain
            let descriptor = Object.getOwnPropertyDescriptor(target, prop as string);
            let proto = Object.getPrototypeOf(target);

            while (!descriptor && proto) {
                descriptor = Object.getOwnPropertyDescriptor(proto, prop as string);
                proto = Object.getPrototypeOf(proto);
            }

            if (descriptor && typeof descriptor.get === 'function') {
                return descriptor.get.call(target);
            }

            return Reflect.get(target, prop, receiver);
        },
        ownKeys(target) {
            const keys = new Set<string | symbol>();

            let obj: object = target;
            while (obj) {
                Reflect.ownKeys(obj).forEach((key) => {
                    if (typeof key === 'string' && !key.startsWith('_')) {
                        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
                        if (descriptor && typeof descriptor.get === 'function') {
                            keys.add(key);
                        }
                    }
                });
                obj = Object.getPrototypeOf(obj);
            }

            return Array.from(keys);
        },
        getOwnPropertyDescriptor(target, prop) {
            const descriptor = Object.getOwnPropertyDescriptor(target, prop) ||
                Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), prop);

            if (
                descriptor &&
                typeof descriptor.get === 'function' &&
                typeof prop === 'string' &&
                !prop.startsWith('_')
            ) {
                return {
                    enumerable: true,
                    configurable: true,
                };
            }
            return undefined;
        },
    });
}
