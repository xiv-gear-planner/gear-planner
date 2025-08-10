import {Ability, GcdAbility, OgcdAbility, HasGaugeUpdate, hasGaugeUpdate, Cooldown, LevelModifiable} from "@xivgear/core/sims/sim_types";
import {DrgGaugeManager} from "./drg_gauge";
import {
    DrgAbility, DrgGcdAbility, DrgOgcdAbility,
    DiveReady, DraconianFire, EnhancedPiercingTalonBuff, PowerSurge,
    LanceChargeBuff,
    LifeOfTheDragon,
    NastrondReady,
    StarcrossReady,
    DragonsFlight,
    LifeSurgeBuff
} from "./drg_types";
import {Litany} from "@xivgear/core/sims/buffs";

// TODO: Application delays.

// --- GCDs

// Single-target combo (with combined combo and positional potency)

// Level 70+: True Thrust -> Disembowel -> Chaos Thrust -> Wheeling Thrust -> Drakesbane
//            True Thrust -> Vorpal Thrust -> Full Thrust -> Fang and Claw -> Drakesbane
// Level 76+: Gained Raiden Thrust
// Level 86+: Combo #3 upgraded to Chaotic Spring and Heavens' Thrust
// Level 96+: Combo #2 upgraded to Spiral Blow and Lance Barrage

export const TrueThrust: DrgGcdAbility = {
    // 1
    type: 'gcd',
    name: "True Thrust",
    id: 75,
    potency: 170,
    appDelay: 0.76,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 76,
            potency: 230,
        },
    ],
};

export const RaidenThrust: DrgGcdAbility = {
    // ab1 - level 76+
    type: 'gcd',
    name: "Raiden Thrust",
    id: 16479,
    potency: 280,
    appDelay: 0.62,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: gauge => gauge.gainFirstmindsFocus(),
    levelModifiers: [
        {
            minLevel: 94,
            potency: 320,
        },
    ],
};

export const Disembowel: DrgGcdAbility = {
    // a2
    type: 'gcd',
    name: "Disembowel",
    id: 87,
    potency: 210,
    appDelay: 1.65,
    activatesBuffs: [PowerSurge],
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 76,
            potency: 250,
        },
    ],
};

export const SpiralBlow: DrgGcdAbility = {
    // a2 - level 96+
    type: 'gcd',
    name: "Spiral Blow",
    id: 36955,
    potency: 300,
    appDelay: 1.38,
    activatesBuffs: [PowerSurge],
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const ChaosThrust: DrgGcdAbility = {
    // a3
    type: 'gcd',
    name: "Chaos Thrust",
    id: 88,
    potency: 260,
    dot: {
        id: 118,
        tickPotency: 40,
        duration: 24,
    },
    activatesBuffs: [PowerSurge],
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const ChaoticSpring: DrgGcdAbility = {
    // a3 - level 86+
    type: 'gcd',
    name: "Chaotic Spring",
    id: 25772,
    potency: 300,
    dot: {
        id: 2719,
        tickPotency: 45,
        duration: 24,
    },
    appDelay: 0.45,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 94,
            potency: 340,
        },
    ],
};

export const WheelingThrust: DrgGcdAbility = {
    // a4
    type: 'gcd',
    name: "Wheeling Thrust",
    id: 3556,
    potency: 340,
    appDelay: 0.67,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const VorpalThrust: DrgGcdAbility = {
    // b2
    type: 'gcd',
    name: "Vorpal Thrust",
    id: 78,
    potency: 250,
    appDelay: 1.02,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 76,
            potency: 280,
        },
    ],
};

export const LanceBarrage: DrgGcdAbility = {
    // b2 - level 96+
    type: 'gcd',
    name: "Lance Barrage",
    id: 36954,
    potency: 340,
    appDelay: 0.94,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const FullThrust: DrgGcdAbility = {
    // b3
    type: 'gcd',
    name: "Full Thrust",
    id: 84,
    potency: 380,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const HeavensThrust: DrgGcdAbility = {
    // b3 - level 86+
    type: 'gcd',
    name: "Heavens' Thrust",
    id: 25771,
    potency: 400,
    appDelay: 0.71,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 94,
            potency: 460,
        },
    ],
};

export const FangAndClaw: DrgGcdAbility = {
    // b4
    type: 'gcd',
    name: "Fang and Claw",
    id: 3554,
    potency: 300,
    appDelay: 0.62,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 94,
            potency: 340,
        },
    ],
};

export const Drakesbane: DrgGcdAbility = {
    // ab5
    type: 'gcd',
    name: "Drakesbane",
    id: 36952,
    potency: 380,
    appDelay: 1.65,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 76,
            activatesBuffs: [DraconianFire],
        },
        {
            minLevel: 86,
            potency: 400,
            activatesBuffs: [DraconianFire],
        },
        {
            minLevel: 94,
            potency: 460,
            activatesBuffs: [DraconianFire],
        },
    ],
};

// AoE combo (with combo potency)

export const DoomSpike: DrgGcdAbility = {
    // 1
    type: 'gcd',
    name: "Doom Spike",
    id: 86,
    potency: 110,
    appDelay: 1.29,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const DraconianFury: DrgGcdAbility = {
    // c1 - level 82+
    type: 'gcd',
    name: "Draconian Fury",
    id: 25770,
    potency: 110,
    appDelay: 0.76,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: gauge => gauge.gainFirstmindsFocus(),
};

export const SonicThrust: DrgGcdAbility = {
    // c2
    type: 'gcd',
    name: "Sonic Thrust",
    id: 7397,
    potency: 120,
    appDelay: 0.80,
    activatesBuffs: [PowerSurge],
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

export const CoerthanTorment: DrgGcdAbility = {
    // c3
    type: 'gcd',
    name: "Coerthan Torment",
    id: 16477,
    potency: 150,
    appDelay: 0.49,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
};

// Piercing Talon and ePT

export const PiercingTalon: DrgGcdAbility = {
    type: 'gcd',
    name: "Piercing Talon",
    id: 90,
    potency: 150,
    appDelay: 0.85,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 76,
            potency: 200,
        },
    ],
};

export const EnhancedPiercingTalon: DrgGcdAbility = {
    ...PiercingTalon,
    potency: 250,
    levelModifiers: [
        {
            minLevel: 76,
            potency: 350,
        },
    ],
};


// --- oGCDs

export const LifeSurge: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Life Surge",
    id: 83,
    potency: null,
    appDelay: 0,
    activatesBuffs: [LifeSurgeBuff],
    attackType: "Ability",
    cooldown: {
        time: 40,
        charges: 2, // FIXME: This is wrong but needed for the hardcoded fix
    },
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 88,
            cooldown: {
                time: 40,
                charges: 2,
            },
        },
    ],
};

export const LanceCharge: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Lance Charge",
    id: 85,
    potency: null,
    appDelay: 0.62,
    activatesBuffs: [LanceChargeBuff],
    attackType: "Ability",
    cooldown: {
        time: 60,
    },
    updateGauge: _ => {},
};

export const Jump: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Jump",
    id: 92,
    potency: 320,
    appDelay: 0.49,
    animationLock: 0.8,
    activatesBuffs: [DiveReady],
    attackType: "Ability",
    cooldown: {
        time: 30,
    },
    updateGauge: _ => {},
};

export const HighJump: DrgOgcdAbility = {
    // level 74+
    type: 'ogcd',
    name: "High Jump",
    id: 16478,
    potency: 400,
    appDelay: 0.49,
    animationLock: 0.8,
    activatesBuffs: [DiveReady],
    attackType: "Ability",
    cooldown: {
        time: 30,
    },
    updateGauge: _ => {},
};

export const ElusiveJump: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Elusive Jump",
    id: 94,
    potency: null,
    animationLock: 0.8,
    activatesBuffs: [EnhancedPiercingTalonBuff],
    attackType: "Ability",
    cooldown: {
        time: 30,
    },
    updateGauge: _ => {},
};

export const DragonfireDive: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Dragonfire Dive",
    id: 96,
    potency: 500,
    appDelay: 2.23,
    animationLock: 0.8,
    attackType: "Ability",
    cooldown: {
        time: 120,
    },
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 92,
            activatesBuffs: [DragonsFlight],
        },
    ],
};

export const BattleLitany: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Battle Litany",
    id: 3557,
    potency: null,
    appDelay: 0.62,
    activatesBuffs: [Litany],
    attackType: "Ability",
    cooldown: {
        time: 120,
    },
    updateGauge: _ => {},
};

export const Geirskogul: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Geirskogul",
    id: 3555,
    potency: 280,
    appDelay: 0.67,
    activatesBuffs: [LifeOfTheDragon, NastrondReady],
    attackType: "Ability",
    cooldown: {
        time: 60,
    },
    updateGauge: _ => {},
};

export const MirageDive: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Mirage Dive",
    id: 7399,
    potency: 380,
    appDelay: 0.80,
    attackType: "Ability",
    updateGauge: _ => {},
};

export const Nastrond: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Nastrond",
    id: 7400,
    potency: 720,
    appDelay: 0.76,
    attackType: "Ability",
    cooldown: {
        time: 10,
    },
    updateGauge: _ => {},
};

export const Stardiver: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Stardiver",
    id: 16480,
    potency: 840,
    appDelay: 1.29,
    animationLock: 1.5,
    attackType: "Ability",
    cooldown: {
        time: 30,
    },
    updateGauge: _ => {},
    levelModifiers: [
        {
            minLevel: 100,
            activatesBuffs: [StarcrossReady],
        },
    ],
};

export const WyrmwindThrust: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Wyrmwind Thrust",
    id: 25773,
    potency: 440,
    appDelay: 1.20,
    attackType: "Ability",
    cooldown: {
        time: 10,
    },
    updateGauge: gauge => gauge.firstmindsFocus -= 2,
};

export const RiseOfTheDragon: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Rise of the Dragon",
    id: 36953,
    potency: 550,
    appDelay: 1.16,
    attackType: "Ability",
    updateGauge: _ => {},
};

export const Starcross: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Starcross",
    id: 36956,
    potency: 1000,
    appDelay: 0.98,
    attackType: "Ability",
    updateGauge: _ => {},
};
