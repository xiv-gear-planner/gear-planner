import {CharacterGearSet} from "@xivgear/core/gear";
import {makeFakeSet} from "@xivgear/core/test/test_utils";
import {JobMultipliers} from "@xivgear/xivmath/geartypes";
import {getClassJobStats, getLevelStats} from "@xivgear/xivmath/xivconstants";
import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";

export const filler: GcdAbility = {
    type: 'gcd',
    name: "Glare",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
};

export const weaponSkill: GcdAbility = {
    type: 'gcd',
    name: "WepSkill",
    potency: 310,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 1.5
};

export const nop: GcdAbility = {
    type: 'gcd',
    name: "NOP",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 2.0
};

export const dia: GcdAbility = {
    type: 'gcd',
    name: "Dia",
    potency: 65,
    dot: {
        id: 1871,
        tickPotency: 65,
        duration: 30
    },
    attackType: "Spell",
    gcd: 2.5,
};

export const assize: OgcdAbility = {
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability"
};

export const pom: OgcdAbility = {
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [
        {
            name: "Presence of Mind",
            selfOnly: true,
            duration: 15,
            effects: {
                haste: 20,
            },
        }
    ],
    attackType: "Ability"
};

export const misery: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1240,
    attackType: "Spell",
    gcd: 2.5,
};

export const lily: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
};
// Replace data that would normally be loaded from xivapi with fixed data
const jobStatMultipliers: JobMultipliers = {
    dexterity: 105,
    hp: 105,
    intelligence: 105,
    mind: 115,
    strength: 55,
    vitality: 100
};
// Stats from a set. These should be the stats WITH items and race bonus, but WITHOUT party bonus
const rawStats = {
    // From https://share.xivgear.app/share/74fb005d-086f-45d3-bee8-9a211559f7df
    crit: 2287,
    determination: 1806,
    dexterity: 409,
    dhit: 400,
    hp: 0,
    intelligence: 409,
    mind: 3376,
    piety: 535,
    skillspeed: 400,
    spellspeed: 1522,
    strength: 214,
    tenacity: 400,
    vitality: 3321,
    wdMag: 132,
    wdPhys: 132,
    weaponDelay: 3.44
};
// Finalize the stats (add class modifiers, party bonus, etc)
const stats = finalizeStats(rawStats, 90, getLevelStats(90), 'WHM', {
    ...getClassJobStats('WHM'),
    jobStatMultipliers: jobStatMultipliers
}, 5);

// Turn the stats into a fake gear set. This object does not implement all of the methods that a CharacterGearSet
// should, only the ones that would commonly be used in a simulation.
export const exampleGearSet: CharacterGearSet = makeFakeSet(stats);
