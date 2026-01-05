import {RawStats} from "@xivgear/xivmath/geartypes";

export type EmptyObject = Record<string, never>;

export type PropertyOfType<ObjectType, PropType> = {
    [K in keyof ObjectType]: ObjectType[K] extends PropType ? K : never;
}[keyof ObjectType] & string

export type AnyStringIndex = {
    [K: string]: unknown;
}

export type AnyStringIndexOpt = Partial<AnyStringIndex>

export type RawStatsPart = Partial<RawStats>;

export type PublicOnly<T> = { [key in keyof T]: T[key] }
