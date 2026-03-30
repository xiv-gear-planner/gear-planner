import type {Buff} from "@xivgear/core/sims/sim_types";

export const ReassembledBuff: Buff = {
    name: 'Reassembled',
    duration: 5,
    statusId: 851,
    selfOnly: true,
    effects: {
        forceCrit: true,
        forceDhit: true,
    },
    appliesTo: (ability) => ability.type === 'gcd',
    beforeSnapshot: (buff) => buff.removeSelf(),
};

export const OverheatedBuff: Buff = {
    name: 'Overheated',
    duration: 10,
    statusId: 2688,
    selfOnly: true,
    stacks: 5,
    effects: {},
    appliesTo: (ability) => ability.type === 'gcd',
    beforeAbility: (_, ability) => ({
        ...ability,
        potency: ability.potency + 20,
    }),
    beforeSnapshot: (buff, ability) => {
        buff.subtractStacksSelf(1);
        return ability;
    },
};

export const FullMetalMachinistBuff: Buff = {
    name: 'Full Metal Machinist',
    duration: 30,
    statusId: 3864,
    effects: {},
    selfOnly: true,
    appliesTo: (ability) => ability.name === 'Full Metal Field',
    beforeSnapshot: (buff) => buff.removeSelf(),
};

export const HyperchargedBuff: Buff = {
    name: 'Hypercharged',
    duration: 30,
    statusId: 3804,
    selfOnly: true,
    effects: {},
    appliesTo: (ability) => ability.name === 'Hypercharge',
    beforeSnapshot: (buff) => buff.removeSelf(),
};

export const ExcavatorReadyBuff: Buff = {
    name: 'Excavator Ready',
    duration: 30,
    statusId: 3865,
    effects: {},
    selfOnly: true,
    appliesTo: (ability) => ability.name === 'Excavator',
    beforeSnapshot: (buff) => buff.removeSelf(),
};

// TODO: final damage (should apply a 1-tick instant "DoT" of potency 240 * stacks)
export const WildfireBuff: Buff = {
    name: 'Wildfire',
    duration: 10,
    statusId: 3865, // TODO
    effects: {},
    selfOnly: true,
    appliesTo: (ability) => ability.type === 'gcd',
};
