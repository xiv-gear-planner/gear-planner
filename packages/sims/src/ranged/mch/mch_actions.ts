import {ExcavatorReadyBuff, FullMetalMachinistBuff, HyperchargedBuff, OverheatedBuff, ReassembledBuff, WildfireBuff} from "./mch_buffs";
import type {MchGcdAbility, MchOgcdAbility} from "./mch_types";

export const HeatedSplitShot: MchGcdAbility = {
    type: 'gcd',
    name: 'Heated Split Shot',
    id: 7411,
    potency: 220,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge) => gauge.heat += 5,
} as const;

export const HeatedSlugShot: MchGcdAbility = {
    type: 'gcd',
    name: 'Heated Slug Shot',
    id: 7412,
    potency: 320,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge) => gauge.heat += 5,
} as const;

export const HeatedCleanShot: MchGcdAbility = {
    type: 'gcd',
    name: 'Heated Clean Shot',
    id: 7413,
    potency: 420,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge) => {
        gauge.heat += 5;
        gauge.battery += 10;
    },
} as const;

export const Drill: MchGcdAbility = {
    type: 'gcd',
    name: 'Drill',
    id: 16498,
    potency: 660,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    cooldown: {
        time: 20,
        charges: 2,
    },
} as const;

export const AirAnchor: MchGcdAbility = {
    type: 'gcd',
    name: 'Air Anchor',
    id: 16500,
    potency: 660,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge) => gauge.battery += 20,
    cooldown: {
        time: 40,
        reducedBy: 'skillspeed',
    },
} as const;

export const Chainsaw: MchGcdAbility = {
    type: 'gcd',
    name: 'Chainsaw',
    id: 25788,
    potency: 660,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [ExcavatorReadyBuff],
    updateGauge: (gauge) => gauge.battery += 20,
    cooldown: {
        time: 60,
        reducedBy: 'skillspeed',
    },
} as const;

export const Excavator: MchGcdAbility = {
    type: 'gcd',
    name: 'Excavator',
    id: 36981,
    potency: 660,
    attackType: 'Weaponskill',
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [],
    updateGauge: (gauge) => gauge.battery += 20,
} as const;

export const FullMetalField: MchGcdAbility = {
    type: 'gcd',
    name: 'Full Metal Field',
    id: 36982,
    potency: 900,
    attackType: 'Weaponskill',
    gcd: 2.5,
    autoCrit: true,
    autoDh: true,
} as const;

export const BlazingShot: MchGcdAbility = {
    type: 'gcd',
    name: 'Blazing Shot',
    id: 36978,
    potency: 240,
    attackType: 'Weaponskill',
    gcd: 1.5,
    fixedGcd: true,
} as const;

export const DoubleCheck: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Double Check',
    id: 36979,
    potency: 180,
    attackType: 'Ability',
    cooldown: {
        time: 30,
        charges: 3,
    },
} as const;

export const Checkmate: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Checkmate',
    id: 36980,
    potency: 180,
    attackType: 'Ability',
    cooldown: {
        time: 30,
        charges: 3,
    },
} as const;

export const BarrelStabilizer: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Barrel Stabilizer',
    id: 7414,
    potency: null,
    attackType: 'Ability',
    cast: 0,
    activatesBuffs: [FullMetalMachinistBuff, HyperchargedBuff],
    cooldown: {
        time: 120,
    },
} as const;

export const Hypercharge: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Hypercharge',
    id: 17209,
    potency: null,
    attackType: 'Ability',
    activatesBuffs: [OverheatedBuff],
    updateGauge: (gauge) => gauge.heat -= 50,
    cooldown: {
        time: 10,
    },
} as const;

// also remember that wildfire cannot dh/crit
export const Wildfire: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Wildfire',
    id: 2878,
    potency: 0, // potency is calculated during sim
    attackType: 'Ability',
    activatesBuffs: [WildfireBuff],
    cooldown: {
        time: 120,
    },
} as const;

// Not directly used but action queued when Wildfire explodes
export const Detonator: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Detonator',
    id: 16766,
    potency: 0,
    attackType: 'Ability',
    animationLock: 0,
    appDelay: 0,
    dot: {
        duration: 1,
        id: 16766,
        tickPotency: 240 * 6, // could technically be less than 5, but we will always use it during 2 min anyway
    },
};

export const Reassemble: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Reassemble',
    id: 2876,
    potency: null,
    attackType: 'Ability',
    activatesBuffs: [ReassembledBuff],
    cooldown: {
        time: 55,
        charges: 2,
    },
} as const;

export const AutomatonQueen: MchOgcdAbility = {
    type: 'ogcd',
    name: 'Automaton Queen',
    id: 16501,
    potency: null,
    attackType: 'Ability',
    cooldown: {
        time: 20.5, // technically 5 but we can't use again before 20.5 seconds
    },
} as const;

export const AutomatonQueenArmPunch: MchOgcdAbility = {
    type: 'ogcd',
    name: '(Automaton Queen) Arm Punch',
    alternativeScalings: ['Pet Action Weapon Damage', 'Automaton Queen Dexterity Scaling'],
    animationLock: 0,
    appDelay: 0,
    id: 16504,
    potency: 2.4, // multiply by battery used
    attackType: 'Ability',
} as const;

export const AutomatonQueenPileBunker: MchOgcdAbility = {
    type: 'ogcd',
    name: '(Automaton Queen) Pile Bunker',
    alternativeScalings: ['Pet Action Weapon Damage', 'Automaton Queen Dexterity Scaling'],
    animationLock: 0,
    appDelay: 0,
    id: 16503,
    potency: 6.8, // multiply by battery used
    attackType: 'Ability',
} as const;

export const AutomatonQueenCrownedCollider: MchOgcdAbility = {
    type: 'ogcd',
    name: '(Automaton Queen) Crowned Collider',
    alternativeScalings: ['Pet Action Weapon Damage', 'Automaton Queen Dexterity Scaling'],
    animationLock: 0,
    appDelay: 0,
    id: 25787,
    potency: 7.8, // multiply by battery used
    attackType: 'Ability',
} as const;
