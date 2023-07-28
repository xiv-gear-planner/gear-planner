import {
    MATERIA_LEVEL_MAX_NORMAL,
    MATERIA_LEVEL_MAX_OVERMELD,
    MATERIA_LEVEL_MIN_RELEVANT,
    MATERIA_SLOTS_MAX
} from "./xivconstants";

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

export class GearStats implements GearStats {
    crit: number = 0;
    det: number = 0;
    dexterity: number = 0;
    dhit: number = 0;
    intelligence: number = 0;
    mind: number = 0;
    piety: number = 0;
    skillspeed: number = 0;
    spellspeed: number = 0;
    strength: number = 0;
    tenacity: number = 0;
    vitality: number = 0;
}


export interface XivItem {
    name: string;
    id: number;
    iconUrl: URL;
}

export interface XivCombatItem extends XivItem {
    stats: GearStats;
}

export interface GearItem extends XivCombatItem {
    gearSlot: GearSlot;
    ilvl: number;
    primarySubstat: keyof GearStats | null;
    secondarySubstat: keyof GearStats | null;
    substatCap: number;
    materiaSlots: MateriaSlot[];
}

export interface Materia extends XivCombatItem {

}

export interface ComputedSetStats extends GearStats {
    gcd: number,
}

export interface MeldableMateriaSlot {
    materiaSlot: MateriaSlot;
    equippedMatiera: Materia | null;
}

export class EquippedItem {
    constructor(gearItem: GearItem, melds: MeldableMateriaSlot[] | undefined = undefined) {
        this.gearItem = gearItem;
        if (melds === undefined) {
            this.melds = [];
            for (let materiaSlot of gearItem.materiaSlots) {
                this.melds.push({
                    materiaSlot: materiaSlot,
                    equippedMatiera: null
                })
            }
        }
    }

    gearItem: GearItem;
    melds: MeldableMateriaSlot[];
}

export class CharacterGearSet {
    _name: string;
    equipment: EquipmentSet;
    listeners: (() => void)[] = [];
    private _dirtyComp: boolean = true;
    private _computedStats: ComputedSetStats;

    constructor() {
        this.name = "foo name goes here"
        this.equipment = new EquipmentSet();
    }

    set name(name) {
        this._name = name;
        this.notifyListeners();
    }

    get name() {
        return this._name;
    }


    setEquip(slot: string, item: GearItem) {
        this._dirtyComp = true;
        this.equipment[slot] = new EquippedItem(item);
        console.log(`Set ${this.name}: slot ${slot} => ${item.name}`);
        this.notifyListeners()
    }

    private notifyListeners() {
        for (let listener of this.listeners) {
            listener();
        }
    }


    notifyMateriaChange() {
        this._dirtyComp = true;
        this.notifyListeners();
    }

    addListener(listener: () => void) {
        this.listeners.push(listener);
    }

    getItemInSlot(slot: string): GearItem | null {
        const inSlot = this.equipment[slot];
        if (inSlot === null || inSlot === undefined) {
            return null;
        }

        return inSlot.gearItem;
    }

    get allStatPieces(): XivCombatItem[] {
        return Object.values(this.equipment)
            .filter(slotEquipment => slotEquipment && slotEquipment.gearItem)
            .flatMap((slotEquipment : EquippedItem) => [slotEquipment.gearItem, ...slotEquipment.melds.map(meldSlot => meldSlot.equippedMatiera).filter(item => item)]);
    }

    // TODO: cache result?
    get computedStats(): ComputedSetStats {
        if (!this._dirtyComp) {
            return this._computedStats;
        }
        const all = this.allStatPieces;
        const combinedStats = new GearStats();
        for (let item of all) {
            for (let entry of Object.entries(combinedStats)) {
                const stat = entry[0] as keyof GearStats;
                combinedStats[stat] = item.stats[stat] + (combinedStats[stat] ?? 0);
            }
        }
        // @ts-ignore
        this._computedStats = {
            ...combinedStats,
            gcd: 1.234,
        }
        this._dirtyComp = false;
        return this._computedStats;
    }
}
export class GearSlotItem {
    slot: EquipSlot;
    item: GearItem;
    slotName: string;
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

export interface MateriaSlot {
    maxGrade: number,
}

export class XivApiGearInfo implements GearItem {
    id: number;
    name: string;
    Icon: URL;
    Stats: Object;
    ilvl: number;
    gearSlot: GearSlot;
    stats: GearStats;
    primarySubstat: keyof GearStats | null;
    secondarySubstat: keyof GearStats | null;
    substatCap: number;
    materiaSlots: MateriaSlot[];

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.ilvl = data['LevelItem'];
        this.Icon = data['IconHD'];
        this.Stats = data['Stats'];
        var eqs = data['EquipSlotCategory'];
        if (eqs['MainHand']) {
            this.gearSlot = GearSlots.Weapon;
        }
        else if (eqs['Head']) {
            this.gearSlot = GearSlots.Head;
        }
        else if (eqs['Body']) {
            this.gearSlot = GearSlots.Body;
        }
        else if (eqs['Gloves']) {
            this.gearSlot = GearSlots.Hand;
        }
        else if (eqs['Legs']) {
            this.gearSlot = GearSlots.Legs;
        }
        else if (eqs['Feet']) {
            this.gearSlot = GearSlots.Feet;
        }
        else if (eqs['Ears']) {
            this.gearSlot = GearSlots.Ears;
        }
        else if (eqs['Neck']) {
            this.gearSlot = GearSlots.Neck;
        }
        else if (eqs['Wrists']) {
            this.gearSlot = GearSlots.Wrist;
        }
        else if (eqs['FingerL'] || eqs['FingerR']) {
            this.gearSlot = GearSlots.Ring;
        }
        else {
            console.error("Unknown slot data!")
            console.error(eqs);
        }

        this.stats = {
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
        const sortedStats = Object.entries({
            crit: this.stats.crit,
            dhit: this.stats.dhit,
            det: this.stats.det,
            spellspeed: this.stats.spellspeed,
            skillspeed: this.stats.skillspeed,
            piety: this.stats.piety,
            tenacity: this.stats.tenacity,
        })
            .sort((left, right) => {
                if (left[1] > right[1]) {
                    return 1;
                }
                else if (left[1] < right[1]) {
                    return -1;
                }
                return 0;
            })
            .filter(item => item[1])
            .reverse();
        if (sortedStats.length < 2) {
            this.primarySubstat = null;
            this.secondarySubstat = null;
            // TODO idk
            this.substatCap = 1000;
        }
        else {
            this.primarySubstat = sortedStats[0][0] as keyof GearStats;
            this.secondarySubstat = sortedStats[1][0] as keyof GearStats;
            this.substatCap = sortedStats[0][1];
        }
        this.materiaSlots = [];
        const baseMatCount: number = data['MateriaSlotCount'];
        const overmeld: boolean = data['IsAdvancedMeldingPermitted'] as boolean;
        for (let i = 0; i < baseMatCount; i++) {
            // TODO: figure out grade automatically
            this.materiaSlots.push({maxGrade: MATERIA_LEVEL_MAX_NORMAL});
        }
        if (overmeld) {
            this.materiaSlots.push({maxGrade: MATERIA_LEVEL_MAX_NORMAL})
            for (let i = this.materiaSlots.length; i < MATERIA_SLOTS_MAX; i++) {
                this.materiaSlots.push({maxGrade: MATERIA_LEVEL_MAX_OVERMELD});
            }
        }
    }


    get iconUrl() {
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
}

export function processRawMateriaInfo(data: Object): Materia[] {
    const out: Materia[] = []
    for (let i = MATERIA_LEVEL_MIN_RELEVANT - 1; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
        const itemData = data['Item' + i];
        const itemName = itemData["Name"];
        const stats = new GearStats();
        const stat = statById(data['BaseParam']['ID']);
        if (!stat || !itemName) {
            continue;
        }
        stats[stat] = data['Value' + i];
        out.push({
            name: itemName,
            id: itemData["ID"],
            iconUrl: itemData["IconHD"],
            stats: stats,
        })
    }
    return out;
}

// TODO: move to constants
export function statById(id: number): keyof GearStats {
    switch (id) {
        case 6:
            return "piety";
        case 19:
            return "tenacity";
        case 22:
            return "dhit";
        case 27:
            return "crit";
        case 45:
            return "skillspeed";
        case 46:
            return "spellspeed";
        default:
            return undefined;
    }
}


export interface SheetExport {
    name: string,
    sets: SetExport[]
}

export type EquipSlotKeys = keyof EquipmentSet;

export interface SetExport {
    name: string,
    items: {
        [K in EquipSlotKeys]?: ItemSlotExport
    };
}

export interface ItemSlotExport {
    id: number,
    materia: ({ id: number } | undefined)[]
}

