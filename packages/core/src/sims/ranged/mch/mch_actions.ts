import {MchHeat} from "./mch_heatgauge";
import {MchBattery} from "./mch_batterygauge";
import {MchGcdAbility, MchogcdAbility, ReassembleBuff, AutomatonQueenBuff, HyperchargeBuff} from "./mch_types";

/**
 * MCH GCD Actions
 */

export const heatedsplitshot: MchGcdAbility = {
    type: 'gcd',
    name: "Heated Split Shot",
    id: 7411,
    potency: 220,
    attackType: "Weaponskill",
    updateHeatGauge: (gauge: Heatgauge) => gauge.heatGauge += 5,
    gcd: 2.5,
    cast: 0,
};

export const heatedslugshot: MchGcdAbility = {
    type: 'gcd',
    name: "Heated Slug Shot",
    id: 7412,
    potency: 320,
    attackType: "Weaponskill",
    updateHeatGauge: (gauge: Heatgauge) => gauge.heatGauge += 5,
    gcd: 2.5,
    cast: 0,
};

export const heatedcleanshot: MchGcdAbility = {
    type: 'gcd',
    name: "Heated Clean Shot",
    id: 7413,
    potency: 420,
    attackType: "Weaponskill",
    updateHeatGauge: (gauge: Heatgauge) => gauge.heatGauge += 5,
    updateBatteryGauge: (gauge: Batterygauge) => gauge.batteryGauge += 10,
    gcd: 2.5,
    cast: 0,
};

export const drill: MchGcdAbility = {
    type: 'gcd',
    name: "Drill",
    id: 16498,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    cooldown: {
        time: 20,
        charges: 2,
    },
};

export const chainsaw: MchGcdAbility = {
    type: 'gcd',
    name: "Chainsaw",
    id: 25788,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [ExcavatorBuff],
    updateBatteryGauge: (gauge: Batterygauge) => gauge.batteryGauge += 20,
    cooldown: {
        time: 60,
    },
};

export const excavator: MchGcdAbility = {
    type: 'gcd',
    name: "Excavator",
    id: 36981,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBatteryGauge: (gauge: Batterygauge) => gauge.batteryGauge += 20,
};

export const airanchor: MchGcdAbility = {
    type: 'gcd',
    name: "Air Anchor",
    id: 16500,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBatteryGauge: (gauge: Batterygauge) => gauge.batteryGauge += 20,
    cooldown: {
        time: 60,
    },
};

export const fullmetalfield: MchGcdAbility = {
    type: 'gcd',
    name: "Full Metal Field",
    id: 36982,
    potency: 900,
    attackType: "Weaponskill",
    gcd: 2.5,
    autoCrit: true,
    autoDh: true,
};

export const blazingshot: MchGcdAbility = {
    type: 'gcd',
    name: "Blazing Shot",
    id: 36978,
    potency: 240 + 20,
    attackType: "Weaponskill",
    gcd: 1.5,
};

/**
 * MCH oGCD Actions
 */

export const hypercharge: MchoGcdAbility = {
    type: 'ogcd',
    name: "Hypercharge",
    id: 17209,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [HyperchargeBuff],
    updateHeatGauge: (gauge: Heatgauge) => gauge.heatGauge -= 50,
};

export const barrelstabilizer: MchoGcdAbility = {
    type: 'ogcd',
    name: "Barrel Stabilizer",
    id: 7414,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [FullmetalfieldBuff],
    updateHeatGauge: (gauge: Heatgauge) => gauge.heatGauge += 50,
};

export const reassemble: MchoGcdAbility = {
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

export const automatonqueen: MchoGcdAbility = {
    type: 'ogcd',
    name: "Automaton Queen",
    id: 16501,
    alternativeScalings: ["Pet Action Weapon Damage"],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 6,
    },
    updateBatteryGauge: (gauge: Batterygauge) => gauge.batteryGauge = 0, 
    /* need to fix this */
    /* activatesBuffs: [AutomatonQueenBuff], */
};

export const checkmate: MchoGcdAbility = {
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

export const doublecheck: MchoGcdAbility = {
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