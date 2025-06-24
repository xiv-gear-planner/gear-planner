import {BuffController, PersonalBuff, PartyBuff, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {MNKGauge} from "./mnk_gauge";
import {FuryAbility, MnkGcdAbility, MnkOgcdAbility} from "./mnk_types";
import {noStatusId} from "../../buff_helpers";

export const OpoForm: PersonalBuff = {
    name: "Opo-Opo Form",
    selfOnly: true,
    duration: 30,
    statusId: 107,
    effects: {
        // forces crit on bootshine and leaping opo
        // provides opo-opo's fury stack on dragon kick
    },
    appliesTo: (ability) => OPO_ABILITIES.includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.removeSelf();
        if ([Bootshine.id, LeapingOpo.id].includes(ability.id)) {
            return {
                ...ability,
                autoCrit: true,
            };
        }
        else if (ability.id === DragonKick.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, OpoFury],
            };
        }
        return ability;
    },
};

export const OpoFury: PersonalBuff = {
    name: "Opo-Opo Fury",
    // fake status ID until issue 613 is fixed
    statusId: noStatusId(),
    selfOnly: true,
    effects: {
        // flat 200 potency increase
    },
    appliesTo: (ability) => [Bootshine.id, LeapingOpo.id].includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.removeSelf();
        return {
            ...ability,
            potency: ability.potency + 200,
        };
    },
};

export const RaptorForm: PersonalBuff = {
    name: "Raptor Form",
    selfOnly: true,
    duration: 30,
    statusId: 108,
    effects: {
        // allows execution of twin snakes and true strike I and II
    },
    appliesTo: (ability) => RAPTOR_ABILITIES.includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.removeSelf();
        if (ability.id === TwinSnakes.id) {
            const a =  {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, RaptorFury],
            };
            return a;
        }
        return ability;
    },
};

export const RaptorFury: PersonalBuff = {
    name: "Raptor Fury",
    // fake status ID until issue 613 is fixed
    statusId: noStatusId(),
    selfOnly: true,
    effects: {
        // flat 200 potency increase
    },
    appliesTo: (ability) => [TrueStrike.id, RisingRaptor.id].includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.removeSelf();
        return {
            ...ability,
            potency: ability.potency + 200,
        };
    },
};


export const CoeurlForm: PersonalBuff = {
    name: "Coeurl Form",
    selfOnly: true,
    duration: 30,
    statusId: 109,
    effects: {
        // allows execution of demolish, snap punch I and II
    },
    appliesTo: (ability) => COUERL_ABILITIES.includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.removeSelf();
        if (ability.id === Demolish.id) {
            const a =  {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, CoeurlFury],
            };
            return a;
        }
        return ability;
    },
};


export const CoeurlFury: PersonalBuff = {
    name: "Coeurl Fury",
    // fake status ID until issue 613 is fixed
    statusId: noStatusId(),
    selfOnly: true,
    stacks: 2,
    effects: {
        // flat 150 potency increase
    },
    appliesTo: (ability) => [SnapPunch.id, PouncingCoeurl.id].includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.subtractStacksSelf(1);
        return {
            ...ability,
            potency: ability.potency + 150,
        };
    },
};

export const PerfectBalanceBuff: PersonalBuff = {
    name: "Perfect Balance",
    selfOnly: true,
    duration: 30,
    statusId: 110,
    stacks: 3,
    effects: {
        // allows execution of all form Weaponskills and additionally builds beast chakra
    },
    appliesTo: (ability) => FORM_ABILITIES.includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.subtractStacksSelf(1);
        if ([Bootshine.id, LeapingOpo.id].includes(ability.id)) {
            return {
                ...ability,
                autoCrit: true,
            };
        }
        else if (ability.id === DragonKick.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, OpoFury],
            };
        }
        else if (ability.id === TwinSnakes.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, RaptorFury],
            };
        }
        else if (ability.id === Demolish.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, CoeurlFury],
            };
        }
        return ability;
    },
};

export const FormlessFist: PersonalBuff = {
    name: "Formless Fist",
    selfOnly: true,
    duration: 30,
    statusId: 2513,
    effects: {
        // allows execution of all form Weaponskills
    },
    appliesTo: (ability) => FORM_ABILITIES.includes(ability.id),
    beforeSnapshot: (controller: BuffController, ability) => {
        controller.removeSelf();
        if ([Bootshine.id, LeapingOpo.id].includes(ability.id)) {
            return {
                ...ability,
                autoCrit: true,
            };
        }
        else if (ability.id === DragonKick.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, OpoFury],
            };
        }
        else if (ability.id === TwinSnakes.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, RaptorFury],
            };
        }
        else if (ability.id === Demolish.id) {
            return {
                ...ability,
                activatesBuffs: [...ability.activatesBuffs, CoeurlFury],
            };
        }
        return ability;
    },
};

export const RiddleOfFireBuff: PersonalBuff = {
    name: "Riddle of Fire",
    selfOnly: true,
    duration: 20.7,
    statusId: 1181,
    effects: {
        dmgIncrease: 0.20,
    },
};

export const BrotherhoodBuff: PartyBuff = {
    job: "MNK",
    cooldown: 120,
    name: "Brotherhood",
    selfOnly: false,
    duration: 20,
    statusId: 1185,
    effects: {
        // Additional effect: allows the opening of up to ten chakra,
        dmgIncrease: 0.05,
    },
};

/** Look at mnk_sim to see how this is shimmed.
  * Hint recommended that we should assume 2.5 GCD for the 7 other party members since chakra is probabilistic right now.
  */
export const MeditativeBrotherhood: PartyBuff = {
    job: "MNK",
    cooldown: 120,
    name: "Meditative Brotherhood",
    selfOnly: false,
    duration: 20,
    statusId: 1182,
    effects: {
        // Party members under this buff have a 20% chance of generating chakra on a weaponskill / spell
    },
};

export const RiddleOfWindBuff: PersonalBuff = {
    name: "Riddle of Wind",
    duration: 15,
    statusId: 2687,
    appliesTo: (ability) => ability.attackType === 'Auto-attack',
    effects: {
        /**
         * Riddle of Wind is actually a 50% increase type-Y speed buff. But until gear-planner supports type-Y and
         * type-Z speed buffs separately (this only affects Monk auto attacks currently) the actual recast time
         * of autos can be simulated by pretending it's a 40% type-Z speed buff.
         * The correct in game auto timing is 1.024 between autos.
         */
        haste: 40,
    },
};
export const FiresRumination: PersonalBuff = {
    name: "Fire's Rumination",
    duration: 20,
    statusId: 3843,
    effects: {
        // allows execution of Fire's Reply
    },
    appliesTo: (ability) => ability.id === FiresReply.id,
    beforeSnapshot: (bc, ab) => bc.removeSelf(),
};

export const WindsRumination: PersonalBuff = {
    name: "Wind's Rumination",
    duration: 15,
    statusId: 3842,
    effects: {
        // allows execution of Wind's Reply
    },
    appliesTo: (ability) => ability.id === WindsReply.id,
    beforeSnapshot: (bc, ab) => bc.removeSelf(),
};

export const Bootshine: FuryAbility = {
    name: "Bootshine",
    id: 53,
    type: 'gcd',
    gcd: 2.5,
    potency: 180,
    attackType: "Weaponskill",
    activatesBuffs: [RaptorForm],
    fury: 'opo',
    buildsFury: false,
    updateGaugeLegacy: (gauge: MNKGauge, form) => {
        gauge.opoFury = 0;
        if (form && form.statusId === PerfectBalanceBuff.statusId) {
            gauge.beastChakra.push('opo');
        }
    },
    levelModifiers: [
        {
            minLevel: 84,
            potency: 220,
        },
        {
            minLevel: 92,
            name: "Leaping Opo",
            id: 36945,
            potency: 260,
        }],
};

export const TrueStrike: FuryAbility = {
    name: "True Strike",
    id: 54,
    type: 'gcd',
    gcd: 2.5,
    potency: 260,
    attackType: "Weaponskill",
    activatesBuffs: [CoeurlForm],
    fury: 'raptor',
    buildsFury: false,
    updateGaugeLegacy: (gauge: MNKGauge, form) => {
        gauge.raptorFury = 0;
        if (form && form.statusId === PerfectBalanceBuff.statusId) {
            gauge.beastChakra.push('raptor');
        }
    },
    levelModifiers: [
        {
            minLevel: 84,
            potency: 300,
        },
        {
            minLevel: 92,
            name: "Rising Raptor",
            id: 36946,
            potency: 340,
        },
    ],
};

export const SnapPunch: FuryAbility = {
    name: "Snap Punch",
    id: 56,
    type: 'gcd',
    gcd: 2.5,
    potency: 290, // assumed positional hit
    attackType: "Weaponskill",
    activatesBuffs: [OpoForm],
    fury: 'coeurl',
    buildsFury: false,
    updateGaugeLegacy: (gauge: MNKGauge, form) => {
        gauge.coeurlFury -= 1;
        if (form && form.statusId === PerfectBalanceBuff.statusId) {
            gauge.beastChakra.push('coeurl');
        }
    },
    levelModifiers: [
        {
            minLevel: 84,
            potency: 330, // assumed positional hit
        },
        {
            minLevel: 92,
            name: "Pouncing Couerl",
            id: 36947,
            potency: 370, // assumed positional hit
        }],
};

// I'm not implementing all 4 meditations lol
export const ForbiddenMeditation: MnkGcdAbility = {
    name: "Forbidden Meditation",
    id: 36942,
    type: 'gcd',
    gcd: 1,
    potency: null,
    attackType: "Ability",
    fixedGcd: true,
    updateGaugeLegacy: (gauge: MNKGauge, form, inCombat) => {
        gauge.gainChakra(inCombat ? 1 : 5);
    },
};

export const TwinSnakes: FuryAbility = {
    name: "Twin Snakes",
    id: 61,
    type: 'gcd',
    gcd: 2.5,
    potency: 340,
    attackType: "Weaponskill",
    activatesBuffs: [CoeurlForm],
    fury: 'raptor',
    buildsFury: true,
    updateGaugeLegacy: (gauge: MNKGauge, form) => {
        gauge.raptorFury = 1;
        if (form && form.statusId === PerfectBalanceBuff.statusId) {
            gauge.beastChakra.push('raptor');
        }
    },
    levelModifiers: [
        {
            minLevel: 84,
            potency: 380,
        },
        {
            minLevel: 94,
            potency: 420,
        },
    ],
};

export const Demolish: FuryAbility = {
    name: "Demolish",
    id: 66,
    type: 'gcd',
    gcd: 2.5,
    potency: 280, // assumed positional hit
    attackType: "Weaponskill",
    activatesBuffs: [OpoForm],
    fury: 'coeurl',
    buildsFury: true,
    updateGaugeLegacy: (gauge: MNKGauge, form) => {
        gauge.coeurlFury = 2;
        if (form && form.statusId === PerfectBalanceBuff.statusId) {
            gauge.beastChakra.push('coeurl');
        }
    },
    levelModifiers: [
        {
            minLevel: 84,
            potency: 380, // assumed positional hit
        },
        {
            minLevel: 94,
            potency: 420, // assumed positional hit
        },
    ],
};

/**
 * @see OpoForm for conditional activation of opoFury buff
 */
export const DragonKick: FuryAbility = {
    name: "Dragon Kick",
    id: 74,
    type: 'gcd',
    gcd: 2.5,
    potency: 240,
    attackType: "Weaponskill",
    activatesBuffs: [RaptorForm],
    fury: 'opo',
    buildsFury: true,
    updateGaugeLegacy: (gauge: MNKGauge, form) => {
        if ([FormlessFist.statusId, OpoForm.statusId, PerfectBalanceBuff.statusId].includes(form?.statusId)) {
            gauge.opoFury = 1;
        }
        if (form && form.statusId === PerfectBalanceBuff.statusId) {
            gauge.beastChakra.push('opo');
        }
    },
    levelModifiers: [
        {
            minLevel: 84,
            potency: 280,
        },
        {
            minLevel: 94,
            potency: 320,
        },
    ],
};

export const PerfectBalance: MnkOgcdAbility = {
    name: "Perfect Balance",
    id: 69,
    type: 'ogcd',
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 40,
        reducedBy: 'none',
        charges: 2,
    },
    activatesBuffs: [PerfectBalanceBuff],
    updateGaugeLegacy: (gauge: MNKGauge) => {
        gauge.beastChakra = [];
    },
};

export const FormShift: MnkGcdAbility = {
    name: "Form Shift",
    id: 4262,
    type: 'gcd',
    attackType: "Weaponskill",
    gcd: 2.5,
    potency: null,
    activatesBuffs: [FormlessFist],
};

export const TheForbiddenChakra: MnkOgcdAbility = {
    name: "The Forbidden Chakra",
    id: 3547,
    type: 'ogcd',
    attackType: 'Ability',
    potency: 310,
    cooldown: {
        time: 1,
    },
    updateGaugeLegacy: (gauge: MNKGauge) => {
        gauge.chakra -= 5;
    },
    levelModifiers: [{
        minLevel: 84,
        potency: 400,
    }],
};

export const ElixirField: MnkGcdAbility = {
    name: "Elixir Field",
    id: 3545,
    type: 'gcd',
    attackType: 'Weaponskill',
    gcd: 2.5,
    potency: 800,
    updateGaugeLegacy: (gauge: MNKGauge) => {
        gauge.lunarNadi = 1;
        gauge.beastChakra = [];
    },
    activatesBuffs: [FormlessFist],
    levelModifiers: [{
        minLevel: 92,
        name: "Elixir Burst",
        id: 36948,
        potency: 900,
    }],
};

export const FlintStrike: MnkGcdAbility = {
    name: "Flint Strike",
    id: 25882,
    type: 'gcd',
    attackType: 'Weaponskill',
    gcd: 2.5,
    potency: 800,
    updateGaugeLegacy: (gauge: MNKGauge) => {
        gauge.solarNadi = 1;
        gauge.beastChakra = [];
    },
    activatesBuffs: [FormlessFist],
    levelModifiers: [{
        minLevel: 86,
        name: "Rising Phoenix",
        id: 25768,
        potency: 900,
    }],
};

export const CelestialRevolution: MnkGcdAbility = {
    name: "Celestial Revolution",
    id: 25765,
    type: 'gcd',
    attackType: 'Weaponskill',
    gcd: 2.5,
    potency: 600,
    updateGaugeLegacy: (gauge: MNKGauge) => {
        if (gauge.solarNadi) {
            gauge.lunarNadi = 1;
        }
        else {
            gauge.solarNadi = 1;
        }
        gauge.beastChakra = [];
    },
    activatesBuffs: [FormlessFist],
};

export const TornadoKick: MnkGcdAbility = {
    name: "Tornado Kick",
    id: 3543,
    type: 'gcd',
    attackType: 'Weaponskill',
    gcd: 2.5,
    potency: 1200,
    updateGaugeLegacy: (gauge: MNKGauge) => {
        gauge.lunarNadi = 0;
        gauge.solarNadi = 0;
        gauge.beastChakra = [];
    },
    activatesBuffs: [FormlessFist],
    levelModifiers: [
        {
            minLevel: 90,
            name: "Phantom Rush",
            id: 25769,
            potency: 1400,
        },
        {
            minLevel: 94,
            name: "Phantom Rush",
            id: 25769,
            potency: 1500,
        },
    ],
};

export const RiddleOfFire: MnkOgcdAbility = {
    name: "Riddle of Fire",
    id: 7395,
    type: 'ogcd',
    attackType: 'Ability',
    potency: null,
    cooldown: {
        time: 60,
    },
    activatesBuffs: [RiddleOfFireBuff],
    levelModifiers: [{
        minLevel: 100,
        activatesBuffs: [RiddleOfFireBuff, FiresRumination],
    }],
};
export const Brotherhood: MnkOgcdAbility = {
    name: "Brotherhood",
    id: 7396,
    type: 'ogcd',
    attackType: 'Ability',
    potency: null,
    cooldown: {
        time: 120,
    },
    activatesBuffs: [BrotherhoodBuff, MeditativeBrotherhood],
};

export const RiddleOfWind: MnkOgcdAbility = {
    name: "Riddle of Wind",
    id: 25766,
    type: 'ogcd',
    attackType: 'Ability',
    potency: null,
    cooldown: {
        time: 90,
    },
    activatesBuffs: [RiddleOfWindBuff],
    levelModifiers: [{
        minLevel: 96,
        activatesBuffs: [RiddleOfWindBuff, WindsRumination],
    }],
};

export const SixSidedStar: MnkGcdAbility = {
    name: "Six-sided Star",
    id: 16476,
    type: 'gcd',
    gcd: 5,
    attackType: 'Weaponskill',
    potency: 710, // potency adjusted in MNKCycleProcessor::use
    updateGaugeLegacy: (gauge: MNKGauge) => {
        gauge.chakra = 0;
    },
    levelModifiers: [{
        minLevel: 94,
        potency: 780,
    }],
};

export const RisingPhoenix: MnkGcdAbility = {
    ...FlintStrike,
    name: "Rising Phoenix",
    id: 25768,
    potency: 900,
};

export const PhantomRush: MnkGcdAbility = {
    ...TornadoKick,
    name: "Phantom Rush",
    id: 25769,
    potency: 1150,
    levelModifiers: [{
        minLevel: 94,
        potency: 1500,
    }],
};

export const LeapingOpo: FuryAbility = {
    ...Bootshine,
    name: "Leaping Opo",
    id: 36945,
    potency: 260,
};

export const RisingRaptor: FuryAbility = {
    ...TrueStrike,
    name: "Rising Raptor",
    id: 36946,
    potency: 340,
};

export const PouncingCoeurl: FuryAbility = {
    ...SnapPunch,
    name: "Pouncing Couerl",
    id: 36947,
    potency: 370, // assumed positional hit
};

export const ElixirBurst: MnkGcdAbility = {
    ...ElixirField,
    name: "Elixir Burst",
    id: 36948,
    potency: 900,
};

export const WindsReply: MnkGcdAbility = {
    name: "Wind's Reply",
    id: 36949,
    type: 'gcd',
    attackType: 'Weaponskill',
    gcd: 2.5,
    potency: 1040,
};
export const FiresReply: MnkGcdAbility = {
    name: "Fire's Reply",
    id: 36950,
    type: 'gcd',
    attackType: 'Weaponskill',
    gcd: 2.5,
    potency: 1400,
    activatesBuffs: [FormlessFist],
};

export const OPO_ABILITIES: number[] = [Bootshine.id, DragonKick.id, LeapingOpo.id];
export const BOOTSHINE_ABILITIES: number[] = [Bootshine.id, LeapingOpo.id];
const RAPTOR_ABILITIES: number[] = [TrueStrike.id, TwinSnakes.id, RisingRaptor.id];
const COUERL_ABILITIES: number[] = [SnapPunch.id, Demolish.id, PouncingCoeurl.id];
const FORM_ABILITIES: number[] = [Bootshine.id, DragonKick.id, LeapingOpo.id, TrueStrike.id, TwinSnakes.id, RisingRaptor.id, SnapPunch.id, Demolish.id, PouncingCoeurl.id];
/** The priority of gcds to execute when building a solar blitz to push the highest potency sequence under RoF */
export const SOLAR_WEAKEST_STRONGEST: FuryAbility[] = [DragonKick, Demolish, TwinSnakes, SnapPunch, TrueStrike, Bootshine];
export const OGCD_PRIORITY: OgcdAbility[] = [Brotherhood, RiddleOfFire, RiddleOfWind, TheForbiddenChakra];
