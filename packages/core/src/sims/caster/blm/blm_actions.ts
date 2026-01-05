import {HasGaugeUpdate, HasGaugeCondition} from "@xivgear/core/sims/sim_types";
import {BlmGaugeManager} from "./blm_gauge";
import {BlmElement, BlmGcdAbility, BlmOgcdAbility, FirestarterBuff, LeyLinesBuff, SwiftcastBuff, TriplecastBuff} from "./blm_types";

// GCDs

export const Fire3: BlmGcdAbility = {
    type: 'gcd',
    name: "Fire III",
    element: BlmElement.Fire,
    id: 152,
    potency: 290,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.292,
    cast: 3.5,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.updateForFireSpell(2000);
        gauge.giveAstralFire(3);
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.canUseFireSpell(2000);
    },
};

export const Fire4: BlmGcdAbility = {
    type: 'gcd',
    name: "Fire IV",
    element: BlmElement.Fire,
    id: 3577,
    potency: 300,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.159,
    cast: 2.0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.updateForFireSpell(800);
        gauge.astralSoul += 1;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInFire() && gauge.canUseFireSpell(800);
    },
};

export const Flare: BlmGcdAbility = {
    type: 'gcd',
    name: "Flare",
    element: BlmElement.Fire,
    id: 162,
    potency: 240,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.157,
    cast: 2.0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.updateForFireSpell('flare');
        gauge.astralSoul += 3;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInFire() && gauge.canUseFireSpell('flare');
    },
};

export const FlareStar: BlmGcdAbility = {
    type: 'gcd',
    name: "Flare Star",
    element: BlmElement.Fire,
    id: 36989,
    potency: 500,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.622,
    cast: 2.0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.astralSoul = 0;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.astralSoul === 6;
    },
};

export const Despair: BlmGcdAbility = {
    type: 'gcd',
    name: "Despair",
    element: BlmElement.Fire,
    id: 16505,
    potency: 350,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.556,
    cast: 2.0,
    levelModifiers: [
        {
            minLevel: 100,
            cast: 0,
        },
    ],
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.updateForFireSpell('despair');
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.canUseFireSpell('despair');
    },
};

export const Blizzard3: BlmGcdAbility = {
    type: 'gcd',
    name: "Blizzard III",
    element: BlmElement.Ice,
    id: 154,
    potency: 290,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.890,
    cast: 3.5,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.updateForIceSpell(800);
        gauge.giveUmbralIce(3);
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.canUseIceSpell(800);
    },
};

export const Blizzard4: BlmGcdAbility = {
    type: 'gcd',
    name: "Blizzard IV",
    element: BlmElement.Ice,
    id: 3576,
    potency: 300,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 1.158,
    cast: 2.0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.updateForIceSpell(800);
        gauge.umbralHearts += 3;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInIce() && gauge.canUseIceSpell(800);
    },
};

export const Thunder3: BlmGcdAbility = {
    type: 'gcd',
    name: "Thunder III",
    element: BlmElement.Thunder,
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
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.thunderhead = false;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.thunderhead;
    },
};

export const HighThunder: BlmGcdAbility = {
    type: 'gcd',
    name: "High Thunder",
    element: BlmElement.Thunder,
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
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.thunderhead = false;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.thunderhead;
    },
};

export const Xenoglossy: BlmGcdAbility = {
    type: 'gcd',
    name: "Xenoglossy",
    element: BlmElement.Unaspected,
    id: 16507,
    potency: 890,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.630,
    cast: 0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.polyglot -= 1;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.polyglot > 0;
    },
};

export const Foul: BlmGcdAbility = {
    type: 'gcd',
    name: "Foul",
    element: BlmElement.Unaspected,
    id: 7422,
    potency: 600,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.630,
    cast: 2.0,
    levelModifiers: [
        {
            minLevel: 80,
            cast: 0,
        },
    ],
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.polyglot -= 1;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.polyglot > 0;
    },
};

export const FireParadox: BlmGcdAbility = {
    type: 'gcd',
    name: "Paradox",
    element: BlmElement.Unaspected,
    id: 25797,
    potency: 540,
    attackType: "Spell",
    activatesBuffs: [FirestarterBuff],
    gcd: 2.5,
    appDelay: 0.624,
    cast: 0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.paradox = false;
        gauge.magicPoints -= 1600;
        gauge.firestarter = true;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInFire() && gauge.magicPoints >= 1600 && gauge.paradox;
    },
};

export const IceParadox: BlmGcdAbility = {
    type: 'gcd',
    name: "Paradox",
    element: BlmElement.Unaspected,
    id: 25797,
    potency: 540,
    attackType: "Spell",
    gcd: 2.5,
    appDelay: 0.624,
    cast: 0,
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.paradox = false;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInIce() && gauge.paradox;
    },
};

// oGCDs

export const Transpose: BlmOgcdAbility & HasGaugeUpdate<BlmGaugeManager> = {
    type: 'ogcd',
    name: "Transpose",
    id: 149,
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 5,
    },
    appDelay: 0,
    updateGauge: (gauge: BlmGaugeManager) => {
        if (gauge.isInFire()) {
            // From AFx to UI1
            gauge.giveUmbralIce(1);
        }
        else if (gauge.isInIce()) {
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

export const Amplifier: BlmOgcdAbility & HasGaugeUpdate<BlmGaugeManager> & HasGaugeCondition<BlmGaugeManager> = {
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
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.polyglot += 1;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInIce() || gauge.isInFire();
    },
};

export const Manafont: BlmOgcdAbility & HasGaugeUpdate<BlmGaugeManager> & HasGaugeCondition<BlmGaugeManager> = {
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
    updateGauge: (gauge: BlmGaugeManager) => {
        gauge.magicPoints = 10000;
        gauge.giveAstralFire(3);
        gauge.thunderhead = true;
        gauge.umbralHearts = 3;
        gauge.paradox = true;
    },
    gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
        return gauge.isInFire();
    },
};
