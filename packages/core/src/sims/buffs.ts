import {Ability, PartyBuff} from "./sim_types";

export const Dokumori = {
    name: "Dokumori",
    saveKey: "Mug",
    job: "NIN",
    duration: 21,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 5.46,
    statusId: 3849,
} as const satisfies PartyBuff;

export const Litany = {
    name: "Battle Litany",
    saveKey: "Battle Litany",
    job: "DRG",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        critChanceIncrease: 0.10,
    },
    startTime: 5.60,
    statusId: 786,
} as const satisfies PartyBuff;

export const Brotherhood = {
    name: "Brotherhood",
    saveKey: "Brotherhood",
    job: "MNK",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 7.5,
    // TODO: there are two of these, 1185 and 2174, one is probably pvp
    statusId: 1185,
} as const satisfies PartyBuff;

export const ArcaneCircleBuff = {
    name: "Arcane Circle",
    saveKey: "Arcane Circle",
    job: "RPR",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.03,
    },
    startTime: 4.59,
    statusId: 2599,
} as const satisfies PartyBuff;

export const SearingLight = {
    name: "Searing Light",
    saveKey: "Searing Light",
    job: "SMN",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 4.7,
    statusId: 2703,
} as const satisfies PartyBuff;

export const Embolden = {
    name: "Embolden",
    saveKey: "Embolden",
    job: "RDM",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 6.5,
    // This is the party member version of this, not the self version
    statusId: 1297,
} as const satisfies PartyBuff;

export const StarryMuse = {
    name: "Starry Muse",
    saveKey: "Starry Muse",
    job: "PCT",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    // TODO: Double check if we want to go with this or with the triple-weave opener.
    startTime: 5.0,
    statusId: 3685,
} as const satisfies PartyBuff;

export const Devilment = {
    name: "Devilment",
    saveKey: "Devilment",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    optional: true,
    selfOnly: false,
    effects: {
        dhitChanceIncrease: 0.20,
        critChanceIncrease: 0.20,
    },
    startTime: 7.2,
    statusId: 1825,
} as const satisfies PartyBuff;

/* With how the cycle processer script currently handles buffs, this wouldn't properly work
export const StandardFinish = {
    name: "Standard Finish",
    job: "DNC",
    duration: 60,
    optional: true,
    cooldown: 30,
    effects: {
        dmgIncrease: 0.05,
    }
    startTime: 0,
    statusId: 1821
} as const satisfies PartyBuff;
*/
export const TechnicalFinish = {
    name: "Technical Finish",
    saveKey: "Technical Finish",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 7,
    statusId: 1822,
    // This does not apply to itself
    appliesTo(ability: Ability): boolean {
        const buffList = ability.activatesBuffs;
        return buffList === undefined || !buffList.includes(TechnicalFinish);
    },
} as const satisfies PartyBuff;

export const BattleVoice = {
    name: "Battle Voice",
    saveKey: "Battle Voice",
    job: "BRD",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dhitChanceIncrease: 0.20,
    },
    startTime: 6.4,
    statusId: 141,
} as const satisfies PartyBuff;

export const RadiantFinale = {
    name: "Radiant Finale",
    saveKey: "Radiant Finale",
    job: "BRD",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.06,
    },
    startTime: 5.7,
    statusId: 2964,
} as const satisfies PartyBuff;

export const Chain = {
    name: "Chain",
    saveKey: "Chain",
    job: "SCH",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        critChanceIncrease: 0.10,
    },
    startTime: 7,
    statusId: 1221,
} as const satisfies PartyBuff;

export const Divination = {
    name: "Divination",
    saveKey: "Divination",
    job: "AST",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.06,
    },
    startTime: 7,
    statusId: 1878,
} as const satisfies PartyBuff;

export const AstCard = {
    name: "Single Target AST Card",
    saveKey: "Single Target AST Card",
    job: "AST",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    optional: true,
    effects: {
        dmgIncrease: 0.06,
    },
    startTime: 4,
    // three IDs for this
    statusId: 829,
} as const satisfies PartyBuff;

export const OffGuardBuff = {
    name: "Off-guard",
    saveKey: "Off-guard",
    job: "BLU",
    duration: 15,
    cooldown: 60, // TODO: cooldown is affected by spell speed
    selfOnly: false,
    optional: true,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 5,
    statusId: 1717,
} as const satisfies PartyBuff;

/**
 * TODO: BLU Peculiar Light, Physical Attenuation, Astral Attenuation, and Umbral Attenuation
 * would require damage type and damage aspect support to implement.
 */

export const ALL_BUFFS = [
    Dokumori, Litany, Brotherhood, ArcaneCircleBuff, SearingLight, Embolden, StarryMuse,
    Devilment, TechnicalFinish, BattleVoice, RadiantFinale, Chain, Divination,
    AstCard, OffGuardBuff
] as const;

export type BuffSaveKey = typeof ALL_BUFFS[number]['name'] | typeof ALL_BUFFS[number]['saveKey'];
