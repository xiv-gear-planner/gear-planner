import {BlmGcdAbility, BlmOgcdAbility, FirestarterBuff, LeyLinesBuff, SwiftcastBuff, TriplecastBuff} from "./blm_types";

// GCDs

export const Fire3: BlmGcdAbility = {
    type: 'gcd',
    name: "Fire III",
    element: 'fire',
    id: 152,
    potency: 290,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.292,
    cast: 3.5,
    mp: 2000,
    updateGauge: gauge => gauge.giveAstralFire(3),
};

export const Fire4: BlmGcdAbility = {
    type: 'gcd',
    name: "Fire IV",
    element: 'fire',
    id: 3577,
    potency: 300,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.159,
    cast: 2.0,
    mp: 800,
    updateGauge: gauge => gauge.astralSoul += 1,
};

export const Flare: BlmGcdAbility = {
    type: 'gcd',
    name: "Flare",
    element: 'fire',
    id: 162,
    potency: 240,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.157,
    cast: 2.0,
    mp: 'flare',
    updateGauge: gauge => gauge.astralSoul += 3,
};

export const FlareStar: BlmGcdAbility = {
    type: 'gcd',
    name: "Flare Star",
    element: 'fire',
    id: 36989,
    potency: 500,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.622,
    cast: 2.0,
    mp: 0,
    updateGauge: gauge => gauge.astralSoul -= 6,
};

export const Despair: BlmGcdAbility = {
    type: 'gcd',
    name: "Despair",
    element: 'fire',
    id: 16505,
    potency: 300,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.556,
    cast: 2.0,
    mp: 'all',
    updateGauge: gauge => gauge.paradox = false,
};

export const Blizzard3: BlmGcdAbility = {
    type: 'gcd',
    name: "Blizzard III",
    element: 'ice',
    id: 154,
    potency: 290,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.890,
    cast: 3.5,
    mp: 800,
    updateGauge: gauge => gauge.giveUmbralIce(3),
};

export const Blizzard4: BlmGcdAbility = {
    type: 'gcd',
    name: "Blizzard IV",
    element: 'ice',
    id: 3576,
    potency: 300,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.158,
    cast: 3.5,
    mp: 800,
    updateGauge: gauge => gauge.umbralHearts += 3,
};

export const Thunder3: BlmGcdAbility = {
    type: 'gcd',
    name: "Thunder III",
    id: 153,
    potency: 120,
    dot: {
        id: 163,
        tickPotency: 50,
        duration: 27,
    },
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.025,
    cast: 0,
    mp: 0,
};

export const HighThunder: BlmGcdAbility = {
    type: 'gcd',
    name: "High Thunder",
    id: 36986,
    potency: 150,
    dot: {
        id: 3871,
        tickPotency: 60,
        duration: 30,
    },
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.757,
    cast: 0,
    mp: 0,
};

export const Xenoglossy: BlmGcdAbility = {
    type: 'gcd',
    name: "Xenoglossy",
    id: 16507,
    potency: 890,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.630,
    cast: 0,
    mp: 0,
    updateGauge: gauge => gauge.polyglot -= 1,
};

export const FireParadox: BlmGcdAbility = {
    type: 'gcd',
    name: "Paradox",
    id: 25797,
    potency: 540,
    attackType: "Spell",
    activatesBuffs: [FirestarterBuff],
    gcd: 2.5,
    appDelay: 0.624,
    cast: 0,
    mp: 1600,
    updateGauge: gauge => gauge.paradox = false,
};

export const IceParadox: BlmGcdAbility = {
    type: 'gcd',
    name: "Paradox",
    id: 25797,
    potency: 540,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.624,
    cast: 0,
    mp: 0,
    updateGauge: gauge => gauge.paradox = false,
};

// oGCDs

export const Transpose: BlmOgcdAbility = {
    type: 'ogcd',
    name: "Transpose",
    id: 149,
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 5,
    },
    appDelay: 0,
    updateGauge: gauge => {
        if (gauge.aspect > 0) {
            // From AFx to UI1
            gauge.giveUmbralIce(1);
        }
        else if (gauge.aspect < 0) {
            // From UIx to AF1
            gauge.giveAstralFire(1);
        }
    },
};

export const Swiftcast: BlmOgcdAbility = {
    type: 'ogcd',
    name: "Swiftcast",
    id: 7561,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [SwiftcastBuff],
    cooldown: {
        time: 60,
        charges: 1,
    },
    appDelay: 0,
    levelModifiers: [
        {
            minLevel: 94,
            cooldown: {
                time: 40,
                charges: 1,
            },
        },
    ],
};

export const Triplecast: BlmOgcdAbility = {
    type: 'ogcd',
    name: "Triplecast",
    id: 7421,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [TriplecastBuff],
    cooldown: {
        time: 60,
        charges: 2,
    },
    appDelay: 0,
};

export const LeyLines: BlmOgcdAbility = {
    type: 'ogcd',
    name: "Ley Lines",
    id: 3573,
    potency: null,
    attackType: "Ability",
    activatesBuffs: [LeyLinesBuff],
    cooldown: {
        time: 120,
        charges: 2,
    },
    appDelay: 0.491,
};

export const Amplifier: BlmOgcdAbility = {
    type: 'ogcd',
    name: "Amplifier",
    id: 25796,
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120,
        charges: 1,
    },
    appDelay: 0,
    updateGauge: gauge => gauge.polyglot += 1,
};

export const Manafont: BlmOgcdAbility = {
    type: 'ogcd',
    name: "Manafont",
    id: 158,
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120,
        charges: 1,
    },
    appDelay: 0,
    levelModifiers: [
        {
            minLevel: 84,
            cooldown: {
                time: 100,
                charges: 1,
            },
        },
    ],
    updateGauge: gauge => {
        gauge.magicPoints += 10000;
        gauge.umbralHearts += 3;
        gauge.paradox = true;
    },
};
