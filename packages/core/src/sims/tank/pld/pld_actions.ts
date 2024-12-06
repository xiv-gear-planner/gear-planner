import {AtonementReadyBuff, SupplicationReadyBuff, SepulchreReadyBuff,
    DivineMightBuff, BladeOfHonorReadyBuff, RequiescatBuff, FightOrFlightBuff,
    GoringBladeReadyBuff,
    ConfiteorReadyBuff,
    PldGcdAbility,
    PldOgcdAbility} from './pld_types';

/**
 * Paladin GCD Actions
 */
export const FastBlade: PldGcdAbility = {
    type: 'gcd',
    name: "Fast Blade",
    id: 9,
    attackType: "Weaponskill",
    potency: 150,
    gcd: 2.5,
    cast: 0,
    levelModifiers: [
        {
            minLevel: 84,
            potency: 200,
        },
        {
            minLevel: 94,
            potency: 220,
        },
    ],
};

export const RiotBlade: PldGcdAbility = {
    type: 'gcd',
    name: "Riot Blade",
    id: 15,
    attackType: "Weaponskill",
    potency: 260,
    gcd: 2.5,
    cast: 0,
    levelModifiers: [
        {
            minLevel: 84,
            potency: 300,
        },
        {
            minLevel: 94,
            potency: 330,
        },
    ],
};

export const RoyalAuthority: PldGcdAbility = {
    type: 'gcd',
    name: "Royal Authority",
    id: 3539,
    attackType: "Weaponskill",
    potency: 360,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [DivineMightBuff],
    levelModifiers: [
        {
            minLevel: 76,
            activatesBuffs: [AtonementReadyBuff, DivineMightBuff],
        },
        {
            minLevel: 84,
            potency: 400,
            activatesBuffs: [AtonementReadyBuff, DivineMightBuff],
        },
        {
            minLevel: 94,
            potency: 460,
            activatesBuffs: [AtonementReadyBuff, DivineMightBuff],
        },
    ],
};

export const Atonement: PldGcdAbility = {
    type: 'gcd',
    name: "Atonement",
    id: 16460,
    attackType: "Weaponskill",
    potency: 360,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [SupplicationReadyBuff],
    levelModifiers: [
        {
            minLevel: 84,
            potency: 400,
        },
        {
            minLevel: 94,
            potency: 460,
        },
    ],
};

export const Supplication: PldGcdAbility = {
    type: 'gcd',
    name: "Supplication",
    id: 36918,
    attackType: "Weaponskill",
    potency: 380,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [SepulchreReadyBuff],
    levelModifiers: [
        {
            minLevel: 84,
            potency: 420,
        },
        {
            minLevel: 94,
            potency: 500,
        },
    ],
};

export const Sepulchre: PldGcdAbility = {
    type: 'gcd',
    name: "Sepulchre",
    id: 36919,
    attackType: "Weaponskill",
    potency: 400,
    gcd: 2.5,
    cast: 0,
    levelModifiers: [
        {
            minLevel: 84,
            potency: 440,
        },
        {
            minLevel: 94,
            potency: 540,
        },
    ],
};

export const HolySpirit: PldGcdAbility = {
    type: 'gcd',
    name: "Holy Spirit",
    id: 7384,
    attackType: "Spell",
    potency: 400,
    gcd: 2.5,
    cast: 0,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 500,
        },
    ],
};

export const HolySpiritRequiescat: PldGcdAbility = {
    type: 'gcd',
    name: "Holy Spirit",
    id: 7384,
    attackType: "Spell",
    potency: 600,
    gcd: 2.5,
    cast: 0,
    consumesRequiescat: true,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 700,
        },
    ],
};

export const HolySpiritHardcast: PldGcdAbility = {
    type: 'gcd',
    name: "Holy Spirit (hard cast)",
    id: 7384,
    attackType: "Spell",
    potency: 300,
    gcd: 2.5,
    cast: 1.5,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 400,
        },
    ],
};

export const GoringBlade: PldGcdAbility = {
    type: 'gcd',
    name: "Goring Blade",
    id: 3538,
    attackType: "Weaponskill",
    potency: 700,
    gcd: 2.5,
    cast: 0,
};

export const Confiteor: PldGcdAbility = {
    type: 'gcd',
    name: "Confiteor",
    id: 16459,
    attackType: "Spell",
    potency: 920,
    gcd: 2.5,
    cast: 0,
    consumesRequiescat: true,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 1000,
        },
    ],
};

export const BladeOfFaith: PldGcdAbility = {
    type: 'gcd',
    name: "Blade of Faith",
    id: 25748,
    attackType: "Spell",
    potency: 720,
    gcd: 2.5,
    cast: 0,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 760,
        },
    ],
    consumesRequiescat: true,
};

export const BladeOfTruth: PldGcdAbility = {
    type: 'gcd',
    name: "Blade of Truth",
    id: 25749,
    attackType: "Spell",
    potency: 820,
    gcd: 2.5,
    cast: 0,
    levelModifiers: [
        {
            minLevel: 94,
            potency: 880,
        },
    ],
    consumesRequiescat: true,
};

export const BladeOfValor: PldGcdAbility = {
    type: 'gcd',
    name: "Blade of Valor",
    id: 25750,
    attackType: "Spell",
    potency: 920,
    gcd: 2.5,
    cast: 0,
    consumesRequiescat: true,
    activatesBuffs: [],
    levelModifiers: [
        {
            minLevel: 94,
            potency: 1000,
        },
        {
            minLevel: 100,
            activatesBuffs: [BladeOfHonorReadyBuff],
            potency: 1000,
        },
    ],
};

/**
 * Paladin oGCD Actions
 */
export const FightOrFlight: PldOgcdAbility = {
    type: 'ogcd',
    name: "Fight or Flight",
    id: 20,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 60,
    },
    activatesBuffs: [FightOrFlightBuff, GoringBladeReadyBuff],
};

export const Requiescat: PldOgcdAbility = {
    type: 'ogcd',
    name: "Requiescat",
    id: 7383,
    attackType: "Ability",
    potency: 0,
    cooldown: {
        time: 60,
    },
    activatesBuffs: [RequiescatBuff],
    levelModifiers: [
        {
            minLevel: 80,
            activatesBuffs: [RequiescatBuff, ConfiteorReadyBuff],
        },
    ],
};

export const Imperator: PldOgcdAbility = {
    type: 'ogcd',
    name: "Imperator",
    id: 36921,
    attackType: "Ability",
    potency: 580,
    cooldown: {
        time: 60,
    },
    activatesBuffs: [RequiescatBuff, ConfiteorReadyBuff],
};

export const BladeOfHonor: PldOgcdAbility = {
    type: 'ogcd',
    name: "Blade of Honor",
    id: 36922,
    attackType: "Ability",
    potency: 1000,
    cooldown: {
        time: 1,
    },
};

export const Intervene: PldOgcdAbility = {
    type: 'ogcd',
    name: "Intervene",
    id: 16461,
    animationLock: 0.8,
    attackType: "Ability",
    potency: 150,
    cooldown: {
        time: 30,
        charges: 2,
    },
};

export const SpiritsWithin: PldOgcdAbility = {
    type: 'ogcd',
    name: "Spirits Within",
    id: 29,
    attackType: "Ability",
    potency: 270,
    cooldown: {
        time: 30,
    },
};

export const Expiacion: PldOgcdAbility = {
    type: 'ogcd',
    name: "Expiacion",
    id: 25747,
    attackType: "Ability",
    potency: 450,
    cooldown: {
        time: 30,
    },
};

export const CircleOfScorn: PldOgcdAbility = {
    type: 'ogcd',
    name: "Circle of Scorn",
    id: 23,
    attackType: "Ability",
    potency: 140,
    dot: {
        id: 248,
        tickPotency: 30,
        duration: 15,
    },
    cooldown: {
        time: 30,
    },
};
