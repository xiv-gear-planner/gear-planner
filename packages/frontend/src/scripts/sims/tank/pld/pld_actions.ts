import {AtonementReadyBuff, SupplicationReadyBuff, SepulchreReadyBuff, DivineMightBuff, BladeOfHonorReadyBuff, RequiescatBuff, FightOrFlightBuff, GoringBladeReadyBuff} from './pld_buffs';
import {GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";

/**
 * Paladin GCD Actions
 */

export const FastBlade: GcdAbility = {
    type: 'gcd',
    name: "Fast Blade",
    id: 9,
    attackType: "Weaponskill",
    potency: 220,
    gcd: 2.5,
    cast: 0
};
export const RiotBlade: GcdAbility = {
    type: 'gcd',
    name: "Riot Blade",
    id: 15,
    attackType: "Weaponskill",
    potency: 330,
    gcd: 2.5,
    cast: 0
};
export const RoyalAuthority: GcdAbility = {
    type: 'gcd',
    name: "Royal Authority",
    id: 3539,
    attackType: "Weaponskill",
    potency: 440,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [AtonementReadyBuff, DivineMightBuff]
};

export const Atonement: GcdAbility = {
    type: 'gcd',
    name: "Atonement",
    id: 16460,
    attackType: "Weaponskill",
    potency: 440,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [SupplicationReadyBuff]
}
export const Supplication: GcdAbility = {
    type: 'gcd',
    name: "Supplication",
    // todo update dawntrail
    id: 36918,
    attackType: "Weaponskill",
    potency: 460,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [SepulchreReadyBuff]
}
export const Sepulchre: GcdAbility = {
    type: 'gcd',
    name: "Sepulchre",
    // todo update dawntrail
    id: 36919,
    attackType: "Weaponskill",
    potency: 480,
    gcd: 2.5,
    cast: 0
}

export const HolySpirit: GcdAbility = {
    type: 'gcd',
    name: "Holy Spirit",
    id: 7384,
    attackType: "Spell",
    potency: 470,
    gcd: 2.5,
    cast: 0
}
export const HolySpiritHardcast: GcdAbility = {
    type: 'gcd',
    name: "Holy Spirit (hard cast)",
    id: 7384,
    attackType: "Spell",
    potency: 370,
    gcd: 2.5,
    cast: 1.5
}

export const GoringBlade: GcdAbility = {
    type: 'gcd',
    name: "Goring Blade",
    id: 3538,
    attackType: "Weaponskill",
    potency: 700,
    gcd: 2.5,
    cast: 0
}

export const Confiteor: GcdAbility = {
    type: 'gcd',
    name: "Confiteor",
    id: 16459,
    attackType: "Spell",
    potency: 940,
    gcd: 2.5,
    cast: 0
}
export const BladeOfFaith: GcdAbility = {
    type: 'gcd',
    name: "Blade of Faith",
    id: 25748,
    attackType: "Spell",
    potency: 740,
    gcd: 2.5,
    cast: 0
}
export const BladeOfTruth: GcdAbility = {
    type: 'gcd',
    name: "Blade of Truth",
    id: 25749,
    attackType: "Spell",
    potency: 840,
    gcd: 2.5,
    cast: 0
}
export const BladeOfValor: GcdAbility = {
    type: 'gcd',
    name: "Blade of Valor",
    id: 25750,
    attackType: "Spell",
    potency: 940,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [BladeOfHonorReadyBuff]
}







export const FightOrFlight: OgcdAbility = {
    type: 'ogcd',
    name: "Fight or Flight",
    id: 20,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 60
    },
    activatesBuffs: [FightOrFlightBuff, GoringBladeReadyBuff]
}
export const Imperator: OgcdAbility = {
    type: 'ogcd',
    name: "Imperator",
    id: 36921,
    attackType: "Ability",
    potency: 580,
    cooldown: {
        time: 60
    },
    activatesBuffs: [RequiescatBuff]
}
export const BladeOfHonor: OgcdAbility = {
    type: 'ogcd',
    name: "Blade of Honor",
    // todo update dawntrail
    id: 36922,
    attackType: "Ability",
    potency: 1000,
    cooldown: {
        time: 1
    }
}

export const Intervene: OgcdAbility = {
    type: 'ogcd',
    name: "Intervene",
    id: 16461,
    attackType: "Ability",
    potency: 150,
    cooldown: {
        time: 30,
        charges: 2
    }
}
export const Expiacion: OgcdAbility = {
    type: 'ogcd',
    name: "Expiacion",
    id: 25747,
    attackType: "Ability",
    potency: 450,
    cooldown: {
        time: 30
    }
}
export const CircleOfScorn: OgcdAbility = {
    type: 'ogcd',
    name: "Circle of Scorn",
    id: 23,
    attackType: "Ability",
    potency: 140,
    dot: {
        id: 248,
        tickPotency: 30,
        duration: 15
    },
    cooldown: {
        time: 30
    }
}
