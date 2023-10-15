import {Buff} from "./sim_types";


export const Mug = {
    name: "Mug",
    job: "NIN",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05
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
    effects: {
        dmgIncrease: 0.05
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

export const Devilment = {
    name: "Devilment",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    optional: true,
    effects: {
        dhitChanceIncrease: 0.20,
    }
} as const satisfies Buff;

export const StandardFinish = {
    name: "Standard Finish",
    job: "DNC",
    duration: 20,
    optional: true,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05,
    }
} as const satisfies Buff;

export const TechnicalFinish = {
    name: "Technical Finish",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05,
    }
} as const satisfies Buff;

export const ALL_BUFFS = [
    Mug, Litany, DragonSight, Chain, Devilment, StandardFinish, TechnicalFinish
] as const;

export type BuffName = typeof ALL_BUFFS[number]['name'];