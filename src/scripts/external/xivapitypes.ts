import {RawStatKey} from "../geartypes";

export const RelevantBaseParams = [
    'Strength', 'Dexterity', 'Vitality', 'Intelligence', 'Mind', 'Piety', 'HP', 'Tenacity', 'Direct Hit Rate', 'Critical Hit', 'Skill Speed', 'Spell Speed', 'Determination', 'Physical Damage', 'Magic Damage'
] as const;
export type RelevantBaseParam = typeof RelevantBaseParams[number];

export const BaseParamToStatKey: Record<RelevantBaseParam, RawStatKey> = {
    "Magic Damage": "wdMag",
    "Physical Damage": "wdPhys",
    "Critical Hit": "crit",
    "Direct Hit Rate": "dhit",
    "Skill Speed": "skillspeed",
    "Spell Speed": "spellspeed",
    Determination: "determination",
    Dexterity: "dexterity",
    HP: "hp",
    Intelligence: "intelligence",
    Mind: "mind",
    Piety: "piety",
    Strength: "strength",
    Tenacity: "tenacity",
    Vitality: "vitality"
}

// Ignoring MP and doh/dol stats
export type XivApiStat =
    'Vitality'
    | 'Strength'
    | 'Dexterity'
    | 'Intelligence'
    | 'Mind'
    | 'HP'
    | 'Piety'
    | 'CriticalHit'
    | 'DirectHitRate'
    | 'Determination'
    | 'Tenacity'
    | 'SpellSpeed'
    | 'SkillSpeed'
    | 'MagicalDamage'
    | 'PhysicalDamage';


export const xivApiStatMapping: Record<XivApiStat, RawStatKey> = {
    PhysicalDamage: 'wdPhys',
    MagicalDamage: 'wdMag',
    Vitality: "vitality",
    Strength: "strength",
    Dexterity: "dexterity",
    Intelligence: "intelligence",
    Mind: "mind",
    HP: "hp",
    Piety: "piety",
    CriticalHit: "crit",
    DirectHitRate: "dhit",
    Determination: "determination",
    Tenacity: "tenacity",
    SkillSpeed: "skillspeed",
    SpellSpeed: "spellspeed"
}
