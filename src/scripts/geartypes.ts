export type GearSlot = 'weapon' | 'head' | 'body' | 'gloves' | 'legs' | 'feet' | 'neck' | 'wrist' | 'ring'


export interface GearStats {
    vitality: number,
    strength: number,
    dexterity: number,
    intelligence: number,
    mind: number,
    piety: number,
    crit: number,
    dhit: number,
    det: number,
    tenacity: number
}

export interface GearItem {
    name: String;
    id: number;
    slot: GearSlot;
    ilvl: number;
    stats: GearStats;
}

export interface Materia {
    // TODO
}

export interface EquippedItem {
    item: GearItem;
    melds: Materia[];
}

export class GearSet {
    weapon: EquippedItem;
    head: EquippedItem;
    body: EquippedItem;
    gloves: EquippedItem;
    legs: EquippedItem;
    feet: EquippedItem;
    neck: EquippedItem;
    wrist: EquippedItem;
    leftring: EquippedItem;
    rightring: EquippedItem;
}