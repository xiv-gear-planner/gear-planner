import {Ability, PartyBuff} from "./sim_types";


export const Mug = {
    name: "Mug",
    job: "NIN",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 3.5,
    statusId: 3183
} as const satisfies PartyBuff;

export const Litany = {
    name: "Battle Litany",
    job: "DRG",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    effects: {
        critChanceIncrease: 0.10
    },
    startTime: 7.5,
    statusId: 786
} as const satisfies PartyBuff;

export const DragonSight = {
    name: "Dragon Sight (Other)",
    job: "DRG",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    optional: true,
    effects: {
        dmgIncrease: 0.05
    },
    startTime: 5,
    // TODO: there are two of these, 1184 and 1454, one is probably pvp
    statusId: 1184
} as const satisfies PartyBuff;

export const Brotherhood = {
    name: "Brotherhood",
    job: "MNK",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05
    },
    startTime: 7.5,
    // TODO: there are two of these, 1185 and 2174, one is probably pvp
    statusId: 1185
} as const satisfies PartyBuff;

export const ArcaneCircle = {
    name: "Arcane Circle",
    job: "RPR",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.03
    },
    startTime: 5,
    statusId: 2599
} as const satisfies PartyBuff;

export const DeathsDesign = {
    name: "Death's Design",
    job: "RPR",
    duration: 60, // this is a hack to make up for the fact that the duration is stackable.
                  // Needs to be changed if simulating dropping DD is desired.
    cooldown: 0,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.1
    },
    startTime: 0,
    statusId: 2586
} as const satisfies PartyBuff;

export const SearingLight = {
    name: "Searing Light",
    job: "SMN",
    duration: 30,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.03
    },
    startTime: 1.5,
    statusId: 2703
} as const satisfies PartyBuff;

export const Embolden = {
    name: "Embolden",
    job: "RDM",
    duration: 20,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.05
    },
    startTime: 7,
    // This is the party member version of this, not the self version
    statusId: 1297
} as const satisfies PartyBuff;

export const Devilment = {
    name: "Devilment",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    optional: true,
    selfOnly: false,
    effects: {
        dhitChanceIncrease: 0.20,
        critChanceIncrease: 0.20
    },
    startTime: 7,
    statusId: 1825
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
    }
} as const satisfies PartyBuff;

export const BattleVoice = {
    name: "Battle Voice",
    job: "BRD",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dhitChanceIncrease: 0.20,
    },
    startTime: 6,
    statusId: 141
} as const satisfies PartyBuff;

export const RadiantFinale = {
    name: "Radiant Finale",
    job: "BRD",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.06
    },
    startTime: 6.7,
    statusId: 2964
} as const satisfies PartyBuff;

export const Chain = {
    name: "Chain",
    job: "SCH",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    effects: {
        critChanceIncrease: 0.10
    },
    startTime: 7,
    statusId: 1221
} as const satisfies PartyBuff;

export const Divination = {
    name: "Divination",
    job: "AST",
    duration: 15,
    cooldown: 120,
    selfOnly: false,
    effects: {
        dmgIncrease: 0.06
    },
    startTime: 7,
    statusId: 1878
} as const satisfies PartyBuff;

export const AstCard = {
    name: "Single Target AST Card",
    job: "AST",
    duration: 15,
    cooldown: 30,
    selfOnly: false,
    optional: true,
    effects: {
        dmgIncrease: 0.06
    },
    startTime: 4,
    // three IDs for this
    statusId: 829
} as const satisfies PartyBuff;

export const OffGuardBuff = {
    name: "Off-guard",
    job: "BLU",
    duration: 15,
    cooldown: 60, // TODO: cooldown is affected by spell speed
    selfOnly: false,
    optional: true,
    effects: {
        dmgIncrease: 0.05,
    },
    startTime: 5,
    statusId: 1717
} as const satisfies PartyBuff;

/**
 * TODO: BLU Peculiar Light, Physical Attenuation, Astral Attenuation, and Umbral Attenuation
 * would require damage type and damage aspect support to implement.
 */

export const ALL_BUFFS = [
    Mug, Litany, DragonSight, Brotherhood, ArcaneCircle, SearingLight, Embolden,
    Devilment, TechnicalFinish, BattleVoice, RadiantFinale, Chain, Divination,
    AstCard, OffGuardBuff
] as const;

export type BuffName = typeof ALL_BUFFS[number]['name'];
