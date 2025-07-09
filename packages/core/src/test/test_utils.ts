import {ComputedSetStats, EquipmentSet, GearItem, RawStatKey} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet} from "../gear";

export function makeFakeSet(stats: ComputedSetStats): CharacterGearSet {
    return {
        get computedStats(): ComputedSetStats {
            return stats;
        },
        getItemInSlot(slot: keyof EquipmentSet): GearItem | null {
            // This works for the time being because the sim is only using this to prevent auto-attacks if you
            // did not equip a weapon.
            if (slot === 'Weapon') {
                return {
                    foo: 'bar',
                } as unknown as GearItem;
            }
            else {
                return null;
            }
        },
        isStatRelevant(stat: RawStatKey): boolean {
            return ['piety', 'crit', 'dhit', 'spellspeed', 'determination'].includes(stat);
        },
    } as CharacterGearSet;
}

export class FakeLocalStorage implements Storage {
    private _data: Map<string, string>;

    constructor() {
        this._reset();
        return new Proxy(this, {
            get(target: typeof this, key: string | symbol): unknown {
                if (key in target) {
                    return target[String(key)];
                }
                return target._data.get(key as string) ?? target[String(key)];
            },
            set(target: typeof this, key: string | symbol, newValue: unknown): boolean {
                if (!(key in target)) {
                    target._data.set(String(key), String(newValue));
                    return true;
                }
                return false;
            },
            ownKeys(target: typeof this): ArrayLike<string | symbol> {
                return Array.from(target._data.keys());
            },
            getOwnPropertyDescriptor(target: typeof this, key: string | symbol): PropertyDescriptor | undefined {
                if (target._data.has(String(key))) {
                    return {
                        enumerable: true,
                        configurable: true,
                        value: target._data.get(String(key)),
                    };
                }
                return undefined;
            },
            has(target: typeof this, key: string | symbol): boolean {
                return target._data.has(String(key)) || key in target;
            },
        });
    }

    private _reset(): void {
        this._data = new Map();
    }

    * [Symbol.iterator](): Iterator<string> {
        yield* this._data.keys();
    }

    get length(): number {
        return this._data.size;
    }

    clear(): void {
        this._reset();
    }

    getItem(key: string): string | null {
        if (this._data.has(key)) {
            return this._data.get(key);
        }
        return null;
    }

    key(index: number): string | null {
        const keys = Array.from(this._data.keys());
        return keys[index] ?? null;
    }

    removeItem(key: string): void {
        this._data.delete(key);
    }

    setItem(key: string, value: string): void {
        this._data.set(key, value);
    }

    [key: string]: unknown;

}