import {Buff} from "./sim_types";


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

