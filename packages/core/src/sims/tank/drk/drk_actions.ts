import { Darkside, DrkGauge } from "./drk_gauge";
import { DrkGcdAbility, DrkOgcdAbility, BloodWeaponBuff, DeliriumBuff, ScornBuff, SaltedEarthBuff } from "./drk_types";

export const HardSlash: DrkGcdAbility = {
    type: 'gcd',
    name: "Hard Slash",
    id: 3617,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
};

export const SyphonStrike: DrkGcdAbility = {
    type: 'gcd',
    name: "Syphon Strike",
    id: 3623,
    potency: 380,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateMP: gauge => gauge.magicPoints += 600,
};

export const Souleater: DrkGcdAbility = {
    type: 'gcd',
    name: "Souleater",
    id: 3632,
    potency: 480,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    updateBloodGauge: gauge => gauge.bloodGauge += 20,
};

export const Bloodspiller: DrkGcdAbility = {
    type: 'gcd',
    name: "Bloodspiller",
    id: 7392,
    potency: 580,
    attackType: "Weaponskill",
    gcd: 2.5,
    bloodCost: 50,
    updateBloodGauge: gauge => gauge.bloodGauge -= 50,
};

export const ScarletDelirium: DrkGcdAbility = {
    type: 'gcd',
    name: "Scarlet Delirium",
    id: 36928,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    updateMP: gauge => gauge.magicPoints += 200,
};

export const Comeuppance: DrkGcdAbility = {
    type: 'gcd',
    name: "Comeuppance",
    id: 36929,
    potency: 700,
    attackType: "Weaponskill",
    gcd: 2.5,
    updateMP: gauge => gauge.magicPoints += 200,
};

export const Torcleaver: DrkGcdAbility = {
    type: 'gcd',
    name: "Torcleaver",
    id: 36930,
    potency: 800,
    attackType: "Weaponskill",
    gcd: 2.5,
    updateMP: gauge => gauge.magicPoints += 200,
};

export const Unmend: DrkGcdAbility = {
    type: 'gcd',
    name: "Unmend",
    id: 3624,
    potency: 150,
    attackType: "Spell",
    gcd: 2.5,
};

export const Delirium: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Delirium",
    id: 7390,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [BloodWeaponBuff, DeliriumBuff],
    cooldown: {
        time: 60,
        charges: 1,
    },
};

export const CarveAndSpit: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Carve and Spit",
    id: 3643,
    potency: 540,
    attackType: "Ability",
    cooldown: {
        time: 60,
        charges: 1,
    },
    updateMP: gauge => gauge.magicPoints += 600,
};

export const SaltedEarth: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Salted Earth",
    id: 3639,
    attackType: "Ability",
    activatesBuffs: [SaltedEarthBuff],
    potency: 50, 
    dot: {
        // This is technically just the ID of the salted earth buff, but
        // it'll do. It's important this is a buff because of speed scaling.
        id: 749,
        tickPotency: 50,
        duration: 15,
    },
    cooldown: {
        time: 90,
        charges: 1,
    },
};

export const SaltAndDarkness: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Salt and Darkness",
    id: 25755,
    potency: 500,
    attackType: "Ability",
    cooldown: {
        time: 30,
    },
};

export const LivingShadow: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Living Shadow",
    id: 16472,
    // Not really, but it's a WIP
    potency: 2450,
    attackType: "Ability",
    activatesBuffs: [ScornBuff],
    cooldown: {
        time: 120,
        charges: 1,
    },
};

export const Disesteem: DrkGcdAbility = {
    type: 'gcd',
    name: "Disesteem",
    id: 36932,
    potency: 1000,
    attackType: "Weaponskill",
    gcd: 2.5,
};

export const EdgeOfShadow: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Edge of Shadow",
    id: 16470,
    potency: 460,
    attackType: "Ability",
    cooldown: {
        time: 1,
    },
    activatesBuffs: [Darkside],
    updateMP: (gauge: DrkGauge) => {
        if (gauge.darkArts) {
            gauge.darkArts = false;
        } else {
            gauge.magicPoints -= 3000;
        }
    }
};

export const TheBlackestNight: DrkOgcdAbility = {
    type: 'ogcd',
    name: "The Blackest Night",
    id: 7393,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 15,
    },
    updateMP: (gauge: DrkGauge) => { 
        gauge.magicPoints -= 3000;
        // For the sake of ease, we'll assume that the TBN pops immediately. This is
        // naturally imperfect, but is perfectly serviceable for the purposes of a
        // damage sim.
        gauge.darkArts = true;
    },
};

export const Shadowbringer: DrkOgcdAbility = {
    type: 'ogcd',
    name: "Shadowbringer",
    id: 25757,
    potency: 600,
    attackType: "Ability",
    cooldown: {
        time: 60,
        charges: 2,
    },
};