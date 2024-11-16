import {ArcaneCircleBuff} from "@xivgear/core/sims/buffs";
import {RprGcdAbility, RprOgcdAbility} from "./rpr_types";
import {DeathsDesign, IdealHost} from "./rpr_buff";

export const Slice: RprGcdAbility = {
    type: 'gcd',
    name: "Slice",
    id: 24373,
    potency: 420,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateSoulGauge: gauge => gauge.soulGauge += 10,
};

export const WaxingSlice: RprGcdAbility = {
    type: 'gcd',
    name: "Waxing Slice",
    id: 24374,
    potency: 500,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateSoulGauge: gauge => gauge.soulGauge += 10,
};

export const InfernalSlice: RprGcdAbility = {
    type: 'gcd',
    name: "Infernal Slice",
    id: 24375,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateSoulGauge: gauge => gauge.soulGauge += 10,
};

export const ShadowOfDeath: RprGcdAbility = {
    type: 'gcd',
    name: "Shadow of Death",
    id: 24378,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    appDelay: 0,
    activatesBuffs: [DeathsDesign],
};

export const Harpe: RprGcdAbility = {
    type: 'gcd',
    name: "Harpe",
    id: 24386,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 1.3,
    appDelay: 0.9,
    updateSoulGauge: gauge => gauge.soulGauge += 10,
};


export const Gibbet: RprGcdAbility = {
    type: 'gcd',
    name: "Gibbet",
    id: 24382,
    potency: 620,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateShroudGauge: gauge => gauge.shroudGauge += 10,
};

export const Gallows: RprGcdAbility = {
    type: 'gcd',
    name: "Gallows",
    id: 24383,
    potency: 620,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateShroudGauge: gauge => gauge.shroudGauge += 10,
};

export const SoulSlice: RprGcdAbility = {
    type: 'gcd',
    name: "Soul Slice",
    id: 24380,
    potency: 520,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateSoulGauge: gauge => gauge.soulGauge += 50,
    cooldown: {
        time: 30,
        charges: 2,
    },
};

export const PlentifulHarvest: RprGcdAbility = {
    type: 'gcd',
    name: "Plentiful Harvest",
    id: 24385,
    potency: 1000,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [IdealHost],
};

export const HarvestMoon: RprGcdAbility = {
    type: 'gcd',
    name: "Harvest Moon",
    id: 24388,
    potency: 800,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateSoulGauge: gauge => gauge.soulGauge += 10,
};

export const Communio: RprGcdAbility = {
    type: 'gcd',
    name: "Communio",
    id: 24398,
    potency: 1100,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.3,
};

export const Perfectio: RprGcdAbility = {
    type: 'gcd',
    name: "Perfectio",
    id: 36973,
    potency: 1300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
};

export const ExecutionersGibbet: RprGcdAbility = {
    type: 'gcd',
    name: "Executioner's Gibbet",
    id: 36970,
    potency: 820,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateShroudGauge: gauge => gauge.shroudGauge += 10,
};

export const ExecutionersGallows: RprGcdAbility = {
    type: 'gcd',
    name: "Executioner's Gallows",
    id: 36971,
    potency: 820,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateShroudGauge: gauge => gauge.shroudGauge += 10,
};

export const ExecutionersGallowsUnbuffed: RprGcdAbility = {
    type: 'gcd',
    name: "Executioner's Gallows",
    id: 36971,
    potency: 760,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateShroudGauge: gauge => gauge.shroudGauge += 10,
};

export const VoidReapingUnbuffed: RprGcdAbility = {
    type: 'gcd',
    name: "Void Reaping",
    id: 24395,
    potency: 500,
    attackType: "Weaponskill",
    gcd: 1.5,
    cast: 0,
    fixedGcd: true,
};

export const VoidReaping: RprGcdAbility = {
    type: 'gcd',
    name: "Void Reaping",
    id: 24395,
    potency: 560,
    attackType: "Weaponskill",
    gcd: 1.5,
    cast: 0,
    fixedGcd: true,
};

export const CrossReaping: RprGcdAbility = {
    type: 'gcd',
    name: "Cross Reaping",
    id: 24396,
    potency: 560,
    attackType: "Weaponskill",
    gcd: 1.5,
    cast: 0,
    fixedGcd: true,
};

export const Gluttony: RprOgcdAbility = {
    type: 'ogcd',
    name: "Gluttony",
    id: 24393,
    potency: 520,
    attackType: "Ability",
    updateSoulGauge: gauge => gauge.soulGauge -= 50,
    cooldown: {
        time: 60,
        charges: 1,
    },
};

export const UnveiledGibbet: RprOgcdAbility = {
    type: 'ogcd',
    name: "Unveiled Gibbet",
    id: 24390,
    potency: 440,
    attackType: "Ability",
    updateSoulGauge: gauge => gauge.soulGauge -= 50,
};

export const UnveiledGallows: RprOgcdAbility = {
    type: 'ogcd',
    name: "Unveiled Gallows",
    id: 24391,
    potency: 440,
    attackType: "Ability",
    updateSoulGauge: gauge => gauge.soulGauge -= 50,
};


export const LemuresSlice: RprOgcdAbility = {
    type: 'ogcd',
    name: "Lemure's Slice",
    id: 24399,
    potency: 280,
    attackType: "Ability",
};

export const Sacrificium: RprOgcdAbility = {
    type: 'ogcd',
    name: "Sacrificium",
    id: 36969,
    potency: 530,
    attackType: "Ability",
};

export const Enshroud: RprOgcdAbility = {
    type: 'ogcd',
    name: "Enshroud",
    id: 24394,
    potency: 0,
    attackType: "Ability",
    updateShroudGauge: gauge => gauge.shroudGauge -= 50,
};

export const ArcaneCircle: RprOgcdAbility = {
    type: 'ogcd',
    name: "Arcane Circle",
    id: 24405,
    activatesBuffs: [ArcaneCircleBuff],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120,
        charges: 1,
    },
};
