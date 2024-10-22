import { WarGauge } from "./war_gauge";
import { WarGcdAbility, WarOgcdAbility, SurgingTempest, PrimalRendReadyBuff, PrimalRuinationReadyBuff, InnerReleaseBuff, NascentChaosBuff } from "./war_types";

export const Tomahawk: WarGcdAbility = {
    type: 'gcd',
    name: "Tomahawk",
    id: 46,
    potency: 150,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
};

export const HeavySwing: WarGcdAbility = {
    type: 'gcd',
    name: "Heavy Swing",
    id: 31,
    potency: 220,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
};

export const Maim: WarGcdAbility = {
    type: 'gcd',
    name: "Maim",
    id: 37,
    potency: 340,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBeastGauge: (gauge: WarGauge) => gauge.beastGauge += 10,
};

export const StormsPath: WarGcdAbility = {
    type: 'gcd',
    name: "Storm's Path",
    id: 42,
    potency: 480,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBeastGauge: (gauge: WarGauge) => gauge.beastGauge += 20,
};

export const StormsEye: WarGcdAbility = {
    type: 'gcd',
    name: "Storm's Eye",
    id: 45,
    potency: 480,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [SurgingTempest],
    updateBeastGauge: (gauge: WarGauge) => gauge.beastGauge += 10,
};

export const FellCleave: WarGcdAbility = {
    type: 'gcd',
    name: "Fell Cleave",
    id: 3549,
    potency: 580,
    attackType: "Weaponskill",
    gcd: 2.5,
    beastGaugeCost: 50,
    updateBeastGauge: gauge => gauge.beastGauge -= 50,
};

export const InnerChaos: WarGcdAbility = {
    type: 'gcd',
    name: "Inner Chaos",
    id: 16465,
    potency: 660,
    attackType: "Weaponskill",
    gcd: 2.5,
    beastGaugeCost: 50,
    updateBeastGauge: gauge => gauge.beastGauge -= 50,
};


export const PrimalRend: WarGcdAbility = {
    type: 'gcd',
    name: "Primal Rend",
    id: 25753,
    potency: 700,
    attackType: "Weaponskill",
    activatesBuffs: [PrimalRuinationReadyBuff],
    gcd: 2.5,
};

export const PrimalRuination: WarGcdAbility = {
    type: 'gcd',
    name: "Primal Ruination",
    id: 36925,
    potency: 780,
    attackType: "Weaponskill",
    gcd: 2.5,
};

export const InnerRelease: WarOgcdAbility = {
    type: 'ogcd',
    name: "Inner Release",
    id: 7389,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [InnerReleaseBuff, PrimalRendReadyBuff],
    cooldown: {
        time: 60,
        charges: 1,
    },
};

export const Infuriate: WarOgcdAbility = {
    type: 'ogcd',
    name: "Infuriate",
    id: 52,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [NascentChaosBuff],
    cooldown: {
        time: 60,
        charges: 2,
    },
    updateBeastGauge: (gauge: WarGauge) => gauge.beastGauge += 50,
};


export const PrimalWrath: WarOgcdAbility = {
    type: 'ogcd',
    name: "Primal Wrath",
    id: 36924,
    potency: 700,
    attackType: "Ability",
    cooldown: {
        time: 1,
    },
};

export const Upheaval: WarOgcdAbility = {
    type: 'ogcd',
    name: "Upheaval",
    id: 7387,
    potency: 400,
    attackType: "Ability",
    cooldown: {
        time: 30,
    },
};

export const Onslaught: WarOgcdAbility = {
    type: 'ogcd',
    name: "Onslaught",
    id: 7386,
    potency: 150,
    animationLock: 0.8,
    attackType: "Ability",
    cooldown: {
        time: 30,
        charges: 3,
    },
};
