import {Buff} from "./sim_types";


export const Mug = {
    name: "Mug",
    job: "NIN",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05,
    },
} as const satisfies Buff;

export const Litany = {
    name: "Battle Litany",
    job: "DRG",
    duration: 15,
    cooldown: 120,
    effects: {
        critChanceIncrease: 0.10
    }
} as const satisfies Buff;

export const DragonSight = {
    name: "Dragon Sight (Other)",
    job: "DRG",
    duration: 20,
    cooldown: 120,
    optional: true,
    effects: {
        dmgIncrease: 0.05
    }
} as const satisfies Buff;

export const Brotherhood = {
    name: "Brotherhood",
    job: "MNK",
    duration: 15,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05
    }
} as const satisfies Buff;

export const ArcaneCircle = {
    name: "Arcane Circle",
    job: "RPR",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.03
    }
} as const satisfies Buff;

export const SearingLight = {
    name: "Searing Light",
    job: "SMN",
    duration: 30,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.03
    }
} as const satisfies Buff;

export const Embolden = {
    name: "Embolden",
    job: "RDM",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05
    }
} as const satisfies Buff;

export const Devilment = {
    name: "Devilment",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    optional: true,
    effects: {
        dhitChanceIncrease: 0.20,
        critChanceIncrease: 0.20
    }
} as const satisfies Buff;

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
} as const satisfies Buff;
*/
export const TechnicalFinish = {
    name: "Technical Finish",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05,
    }
} as const satisfies Buff;

export const BattleVoice = {
    name: "Battle Voice",
    job: "BRD",
    duration: 15,
    cooldown: 120,
    effects: {
        dhitChanceIncrease: 0.20,
    }
} as const satisfies Buff;

export const RadiantFinale = {
    name: "Radiant Finale",
    job: "BRD",
    duration: 15,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.06
    }
} as const satisfies Buff;

export const Chain = {
    name: "Chain",
    job: "SCH",
    duration: 15,
    cooldown: 120,
    effects: {
        critChanceIncrease: 0.10
    }
} as const satisfies Buff;

export const Divination = {
    name: "Divination",
    job: "AST",
    duration: 15,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.06
    }
} as const satisfies Buff;

export const AstCard = {
    name: "Single Target AST Card",
    job: "AST",
    duration: 15,
    cooldown: 30,
    optional: true,
    effects: {
        dmgIncrease: 0.06
    }
} as const satisfies Buff;


export const ALL_BUFFS = [
    Mug, Litany, DragonSight, Brotherhood, ArcaneCircle, SearingLight, Embolden, Devilment, TechnicalFinish, BattleVoice, RadiantFinale, Chain, Divination, AstCard
] as const;

export type BuffName = typeof ALL_BUFFS[number]['name'];
