import {JobName} from "../xivconstants";

export type BuffEffects = {
    dmgIncrease?: number,
    critChanceIncrease?: number,
    dhitChanceIncrease?: number,
}

export type Buff = {
    // Name of buff
    name: string,
    // Job of buff
    job: JobName,
    // "Optional" would be things like DNC partner buffs, where merely having the job
    // in your comp does not mean you would necessarily get the buff.
    optional?: boolean,
    // Can only apply to self - not a party/targeted buff
    selfOnly?: boolean,
    // Cooldown
    cooldown: number,
    // Duration
    duration: number,
    // The effect(s) of the buff
    effects: BuffEffects;
}

export const Mug: Buff = {
    name: "Mug",
    job: "NIN",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05
    },
}

export const Litany: Buff = {
    name: "Battle Litany",
    job:"DRG",
    duration: 15,
    cooldown: 120,
    effects: {
        critChanceIncrease: 0.10
    }
}

export const DragonSight: Buff = {
    name: "Dragon Sight (Other)",
    job: "DRG",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05
    }
}

export const Chain: Buff = {
    name: "Chain",
    job: "SCH",
    duration: 15,
    cooldown: 120,
    effects: {
        critChanceIncrease: 0.10
    }
}

export const Devilment: Buff = {
    name: "Devilment",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    optional: true,
    effects: {
        dhitChanceIncrease: 0.20,
    }
}

export const StandardFinish: Buff = {
    name: "Standard Finish",
    job: "DNC",
    duration: 20,
    optional: true,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05,
    }
}

export const TechnicalFinish: Buff = {
    name: "Technical Finish",
    job: "DNC",
    duration: 20,
    cooldown: 120,
    effects: {
        dmgIncrease: 0.05,
    }
}

