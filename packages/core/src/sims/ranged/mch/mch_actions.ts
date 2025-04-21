import {MchGauge} from "./mch_gauge";
import {MchGcdAbility, ReassembleBuff, HyperchargeBuff, HyperchargedBuff, ExcavatorReadyBuff, FullMetalMachinistBuff, MchOgcdAbility} from "./mch_types";

/**
 * MCH GCD Actions
 */

export const HeatedSplitShot: MchGcdAbility = {
    type: 'gcd',
    name: "Heated Split Shot",
    id: 7411,
    potency: 220,
    attackType: "Weaponskill",
    updateHeatGauge: (gauge: MchGauge) => gauge.heatGauge += 5,
    gcd: 2.5,
    cast: 0,
};

export const HeatedSlugShot: MchGcdAbility = {
    type: 'gcd',
    name: "Heated Slug Shot",
    id: 7412,
    potency: 320,
    attackType: "Weaponskill",
    updateHeatGauge: (gauge: MchGauge) => gauge.heatGauge += 5,
    gcd: 2.5,
    cast: 0,
};

export const HeatedCleanShot: MchGcdAbility = {
    type: 'gcd',
    name: "Heated Clean Shot",
    id: 7413,
    potency: 420,
    attackType: "Weaponskill",
    updateHeatGauge: (gauge: MchGauge) => gauge.heatGauge += 5,
    updateBatteryGauge: (gauge: MchGauge) => gauge.batteryGauge += 10,
    gcd: 2.5,
    cast: 0,
};

export const Drill: MchGcdAbility = {
    type: 'gcd',
    name: "Drill",
    id: 16498,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    cooldown: {
        time: 20,
        reducedBy: "skillspeed",
        charges: 2,
    },
};

export const Chainsaw: MchGcdAbility = {
    type: 'gcd',
    name: "Chainsaw",
    id: 25788,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [ExcavatorReadyBuff],
    updateBatteryGauge: (gauge: MchGauge) => gauge.batteryGauge += 20,
    cooldown: {
        time: 60,
        reducedBy: "skillspeed",
    },
};

export const Excavator: MchGcdAbility = {
    type: 'gcd',
    name: "Excavator",
    id: 36981,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBatteryGauge: (gauge: MchGauge) => gauge.batteryGauge += 20,
};

export const AirAnchor: MchGcdAbility = {
    type: 'gcd',
    name: "Air Anchor",
    id: 16500,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBatteryGauge: (gauge: MchGauge) => gauge.batteryGauge += 20,
    cooldown: {
        time: 60,
        reducedBy: "skillspeed",
    },
};

export const FullMetalField: MchGcdAbility = {
    type: 'gcd',
    name: "Full Metal Field",
    id: 36982,
    potency: 900,
    attackType: "Weaponskill",
    gcd: 2.5,
    autoCrit: true,
    autoDh: true,
};

export const BlazingShot: MchGcdAbility = {
    type: 'gcd',
    name: "Blazing Shot",
    id: 36978,
    potency: 240,
    attackType: "Weaponskill",
    gcd: 1.5,
};

/**
 * MCH oGCD Actions
 */

export const Hypercharge: MchOgcdAbility = {
    type: 'ogcd',
    name: "Hypercharge",
    id: 17209,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [HyperchargeBuff],
    updateHeatGauge: (gauge: MchGauge) => gauge.heatGauge -= 50,
};

export const BarrelStabilizer: MchOgcdAbility = {
    type: 'ogcd',
    name: "Barrel Stabilizer",
    id: 7414,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [FullMetalMachinistBuff, HyperchargedBuff],
};

export const Reassemble: MchOgcdAbility = {
    type: 'ogcd',
    name: "Reassemble",
    id: 2876,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [ReassembleBuff],
    cooldown: {
        time: 55,
        charges: 2,
    },
};

export const AutomatonQueen: MchOgcdAbility = {
    type: 'ogcd',
    name: "Automaton Queen",
    id: 16501,
    alternativeScalings: ["Pet Action Weapon Damage"],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 6,
    },
    updateBatteryGauge: (gauge: MchGauge) => gauge.batteryGauge = 0,
    /* need to fix this */
    /* activatesBuffs: [AutomatonQueenBuff], */
};

export const Checkmate: MchOgcdAbility = {
    type: 'ogcd',
    name: "Checkmate",
    id: 36980,
    potency: 170,
    attackType: "Ability",
    cooldown: {
        time: 30,
        charges: 3,
    },
};

export const DoubleCheck: MchOgcdAbility = {
    type: 'ogcd',
    name: "Double Check",
    id: 36979,
    potency: 170,
    attackType: "Ability",
    cooldown: {
        time: 30,
        charges: 3,
    },
};
