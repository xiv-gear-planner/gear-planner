import {AutoAttack, GcdAbility, OgcdAbility, DamagingAbility, Ability} from "@xivgear/core/sims/sim_types";

export const fast: GcdAbility = {
    id: 9,
    type: 'gcd',
    name: "Fast Blade",
    potency: 220,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const riot: GcdAbility = {
    id: 15,
    type: 'gcd',
    name: "Riot Blade",
    potency: 330,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const royal: GcdAbility = {
    id: 3539,
    type: 'gcd',
    name: "Royal Authority",
    potency: 460,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const atone: GcdAbility = {
    id: 16460,
    type: 'gcd',
    name: "Atonement",
    potency: 460,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const supp: GcdAbility = {
    id: 36918,
    type: 'gcd',
    name: "Supplication",
    potency: 500,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const sep: GcdAbility = {
    id: 36919,
    type: 'gcd',
    name: "Sepulchre",
    potency: 540,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const hs: GcdAbility = {
    id: 7384,
    type: 'gcd',
    name: "Holy Spirit",
    potency: 500,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true,
};

export const goring: GcdAbility = {
    id: 3538,
    type: 'gcd',
    name: "Goring Blade",
    potency: 700,
    attackType: "Weaponskill",
    gcd: 2.5,
    fixedGcd: true,
};

export const conf: GcdAbility = {
    id: 16459,
    type: 'gcd',
    name: "Confiteor",
    potency: 1000,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true,
};

export const faith: GcdAbility = {
    id: 25748,
    type: 'gcd',
    name: "Blade of Faith",
    potency: 760,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true,
};

export const truth: GcdAbility = {
    id: 25749,
    type: 'gcd',
    name: "Blade of Truth",
    potency: 880,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true,
};

export const valor: GcdAbility = {
    id: 25750,
    type: 'gcd',
    name: "Blade of Valor",
    potency: 1000,
    attackType: "Spell",
    gcd: 2.5,
    fixedGcd: true,
};

export const cos: OgcdAbility = {
    id: 23,
    type: 'ogcd',
    name: "Circle of Scorn",
    potency: 140,
    dot: {
        id: 248,
        duration: 15,
        tickPotency: 30,
    },
    attackType: "Ability",
};

export const exp: OgcdAbility = {
    id: 25747,
    type: 'ogcd',
    name: "Expiacion",
    potency: 450,
    attackType: "Ability",
};

export const int: OgcdAbility = {
    id: 16461,
    type: 'ogcd',
    name: "Intervene",
    potency: 150,
    attackType: "Ability",
};

export const imp: OgcdAbility = {
    id: 36921,
    type: 'ogcd',
    name: "Imperator",
    potency: 580,
    attackType: "Ability",
};

export const honor: OgcdAbility = {
    id: 36922,
    type: 'ogcd',
    name: "Blade of Honor",
    potency: 1000,
    attackType: "Ability",
};

export const auto: AutoAttack = {
    name: 'Auto Attack',
    type: 'autoattack',
    potency: 90,
    attackType: 'Auto-attack',
    id: 7,
};

export const fof: OgcdAbility = {
    id: 20,
    type: 'ogcd',
    name: "Fight or Flight",
    potency: null,
    attackType: "Ability",
    activatesBuffs: [
        {
            statusId: 76,
            name: "Fight or Flight",
            selfOnly: true,
            duration: 20,
            effects: {
                dmgIncrease: 0.25,
            },
        }
    ],
};

export function buffed(ability: Ability & Partial<DamagingAbility>): Ability {
    if (!ability.dot) {
        return {
            ...ability,
            name: `${ability.name} (FoF)`,
            potency: ability.potency * 1.25,
            id: -ability.id,
        };
    }

    const {dot: d, ...rest} = ability;

    return {
        ...rest,
        name: `${ability.name} (FoF)`,
        potency: ability.potency * 1.25,
        id: -ability.id,
        dot: {
            ...d,
            id: -d.id,
            tickPotency: d.tickPotency * 1.25,
        },
    };
}
