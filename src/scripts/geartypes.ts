export interface GearSlot {

}

export const GearSlots: Record<string, GearSlot> = {
    Weapon: {},
    Head: {},
    Body: {},
    Hand: {},
    Legs: {},
    Feet: {},
    Ears: {},
    Neck: {},
    Wrist: {},
    Ring: {}
} as const;

export interface EquipSlot {
    get gearSlot(): GearSlot;
    name: string;
}

export const EquipSlots: Record<string, EquipSlot> = {
    Weapon: {name: 'Weapon', gearSlot: GearSlots.Weapon},
    Head: {name: 'Head', gearSlot: GearSlots.Head},
    Body: {name: 'Body', gearSlot: GearSlots.Body},
    Hand: {name: 'Hand', gearSlot: GearSlots.Hand},
    Legs: {name: 'Legs', gearSlot: GearSlots.Legs},
    Feet: {name: 'Feet', gearSlot: GearSlots.Feet},
    Ears: {name: 'Ears', gearSlot: GearSlots.Ears},
    Neck: {name: 'Neck', gearSlot: GearSlots.Neck},
    Wrist: {name: 'Wrist', gearSlot: GearSlots.Wrist},
    RingLeft: {name: 'Left Ring', gearSlot: GearSlots.Ring},
    RingRight: {name: 'Right Ring', gearSlot: GearSlots.Ring}
}

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
    tenacity: number,
    spellspeed: number,
    skillspeed: number
}

export interface GearItem {
    name: string;
    id: number;
    icon: URL;
    slot: GearSlot;
    ilvl: number;
    stats: GearStats;
}

export interface Materia {
    // TODO
}

export class EquippedItem {
    gearItem: GearItem;
    melds: Materia[] = [];
}

export class GearSet {
    name: string;
    equipment: EquipmentSet;
    listeners: (() => void)[] = [];

    constructor() {
        this.name = "foo name goes here"
        this.equipment = new EquipmentSet();
    }

    setEquip(slot: string, item: EquippedItem) {
        this.equipment[slot] = item;
        console.log(`Set ${this.name}: slot ${slot} => ${item.gearItem.name}`);
        for (let listener of this.listeners) {
            listener();
        }
    }

    getItemInSlot(slot: string) : GearItem | null {
        const inSlot = this.equipment[slot];
        if (inSlot === null || inSlot === undefined) {
            return null;
        }
        return inSlot.gearItem;
    }
}

export class EquipmentSet {
    Weapon: EquippedItem | null;
    Head: EquippedItem | null;
    Body: EquippedItem | null;
    Hand: EquippedItem | null;
    Legs: EquippedItem | null;
    Feet: EquippedItem | null;
    Neck: EquippedItem | null;
    Wrist: EquippedItem | null;
    RingLeft: EquippedItem | null;
    RingRight: EquippedItem | null;
}

export class XivApiGearInfo implements GearItem {
    id: number;
    name: string;
    Icon: URL;
    Stats: Object;
    ilvl: number;
    slot: GearSlot;

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.ilvl = data['LevelItem'];
        this.Icon = data['IconHD'];
        this.Stats = data['Stats'];
        var eqs = data['EquipSlotCategory'];
        if (eqs['MainHand']) {
            this.slot = GearSlots.Weapon;
        }
        else if (eqs['Head']) {
            this.slot = GearSlots.Head;
        }
        else if (eqs['Body']) {
            this.slot = GearSlots.Body;
        }
        else if (eqs['Gloves']) {
            this.slot = GearSlots.Hand;
        }
        else if (eqs['Legs']) {
            this.slot = GearSlots.Legs;
        }
        else if (eqs['Feet']) {
            this.slot = GearSlots.Feet;
        }
        else if (eqs['Ears']) {
            this.slot = GearSlots.Ears;
        }
        else if (eqs['Neck']) {
            this.slot = GearSlots.Neck;
        }
        else if (eqs['Wrists']) {
            this.slot = GearSlots.Wrist;
        }
        else if (eqs['FingerL'] || eqs['FingerR']) {
            this.slot = GearSlots.Ring;
        }
        else {
            console.error("Unknown slot data!")
            console.error(eqs);
        }
    }


    get icon() {
        return new URL(`https://xivapi.com/${this.Icon}`);
    }

    private getStatRaw(stat: string) {
        const statValues = this.Stats[stat];
        if (statValues === undefined) {
            return 0;
        }
        if (statValues['HQ'] !== undefined) {
            return statValues['HQ'];
        }
        else {
            return statValues['NQ'];
        }
    }

    get stats() {
        return {
            vitality: this.getStatRaw("Vitality"),
            strength: this.getStatRaw("Strength"),
            dexterity: this.getStatRaw("Dexterity"),
            intelligence: this.getStatRaw("Intelligence"),
            mind: this.getStatRaw("Mind"),
            piety: this.getStatRaw("Piety"),
            crit: this.getStatRaw("CriticalHit"),
            dhit: this.getStatRaw("DirectHit"),
            det: this.getStatRaw("Determination"),
            tenacity: this.getStatRaw("Tenacity"),
            spellspeed: this.getStatRaw("SpellSpeed"),
            skillspeed: this.getStatRaw("SkillSpeed"),
        }
    }


}

type Foo = string | number;

class Bar<X = Foo> {
    something: X | Foo;

    doStuff() {
        this.something = 123;
    }
}