import {MchGauge} from "./mch_gauge";
import {MchGcdAbility, ReassembledBuff, OverheatedBuff, HyperchargedBuff, ExcavatorReadyBuff, FullMetalFieldBuff, MchOgcdAbility} from "./mch_types";

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
    activatesBuffs: [OverheatedBuff],
    updateHeatGauge: (gauge: MchGauge) => gauge.heatGauge -= 50,
};

export const BarrelStabilizer: MchOgcdAbility = {
    type: 'ogcd',
    name: "Barrel Stabilizer",
    id: 7414,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [FullMetalFieldBuff, HyperchargedBuff],
};

export const Reassemble: MchOgcdAbility = {
    type: 'ogcd',
    name: "Reassemble",
    id: 2876,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [ReassembledBuff],
    cooldown: {
        time: 55,
        charges: 2,
    },
};

export const Wildfire: MchOgcdAbility = {
    type: 'ogcd',
    name: "Wildfire",
    id: 2878,
    potency: 240 * 6,
    // 240 per GCD, 6 hits
    // 1440 potency total
    attackType: "Ability",
    appDelay: 10,
    //est. time until detonation
    forceNoCrit: true,
    forceNoDh: true,
    cooldown: {
        time: 120,
    },
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

// While Automaton Queen abilities are actually Weaponskills,
// they've all been programmed to be abilities so that it doesn't roll GCD.
export const AutomatonQueen: MchOgcdAbility = {
    type: 'ogcd',
    name: "Automaton Queen",
    id: 16501,
    potency: null,
    // potency is calculated per action queen uses
    attackType: "Ability",
    cooldown: {
        time: 20.5,
        //Cannot summon a new Automaton Queen until the old one has been dismissed.
    },
};

export const AutomatonQueenArmPunch: MchOgcdAbility = {
    type: 'ogcd',
    name: "(Automaton Queen) Arm Punch",
    alternativeScalings: ["Pet Action Weapon Damage"],
    animationLock: 0,
    id: 16504,
    potency: null,
    // potency listed in mch_sheet_sim.ts
    attackType: "Ability",
};

export const AutomatonQueenPileBunker: MchOgcdAbility = {
    type: 'ogcd',
    name: "(Automaton Queen) Pile Bunker",
    alternativeScalings: ["Pet Action Weapon Damage"],
    animationLock: 0,
    id: 16503,
    potency: null,
    // potency listed in mch_sheet_sim.ts
    attackType: "Ability",
};

export const AutomatonQueenCrownedCollider: MchOgcdAbility = {
    type: 'ogcd',
    name: "(Automaton Queen) Crowned Collider",
    alternativeScalings: ["Pet Action Weapon Damage"],
    animationLock: 0,
    id: 25787,
    potency: null,
    // potency listed in mch_sheet_sim.ts
    attackType: "Ability",
};
