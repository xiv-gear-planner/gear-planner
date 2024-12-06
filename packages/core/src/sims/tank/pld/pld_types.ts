import {Ability, Buff, BuffController, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {removeSelf} from "@xivgear/core/sims/common/utils";

// Add a simple function to remove a single stack of a buff, for use with Req:
export function subtractStackSelf(controller: BuffController): void {
    controller.subtractStacksSelf(1);
}

/** A PLD-specific ability. */
export type PldAbility = Ability & Readonly<{
    // PLD doesn't have anything special to its abilities (i.e. no gauge), but this
    // is still useful to have a type for PLD abilities.
}>

export type PldGcdAbility = GcdAbility & PldAbility;

export type PldOgcdAbility = OgcdAbility & PldAbility;

/** Represents the extra data for UsedAbility, primarily for consumption in the UI */
export type PldExtraData = {
    fightOrFlightDuration: number,
    requiescatStacks: number,
};

/**
 * Paladin-specific Buffs
 */
export const FightOrFlightBuff: Buff = {
    name: "Fight or Flight",
    selfOnly: true,
    effects: {
        dmgIncrease: 0.25,
    },
    duration: 19.96, // Not actually 20s, per nikroulah
    statusId: 76,
};

export const RequiescatBuff: Buff = {
    name: "Requiescat",
    selfOnly: true,
    effects: {
        // Buffs Holy Spirits, or at higher levels, allows usage of PLD spell combo.
    },
    duration: 30,
    statusId: 1368,
    stacks: 4,
    appliesTo: ability => ability.attackType === "Spell",
    beforeSnapshot: subtractStackSelf,
};

export const ConfiteorReadyBuff: Buff = {
    name: "Confiteor Ready",
    selfOnly: true,
    effects: {
        // Allows usage of Confiteor
    },
    duration: 30,
    statusId: 3019,
    stacks: 4,
    appliesTo: ability => ability.name === "Confiteor",
    beforeSnapshot: subtractStackSelf,
};

export const GoringBladeReadyBuff: Buff = {
    name: "Goring Blade Ready",
    selfOnly: true,
    effects: {
        // Allows usage of Goring Blade
    },
    duration: 30,
    statusId: 3847,
    appliesTo: ability => ability.name === "Goring Blade",
    beforeSnapshot: removeSelf,
};

export const AtonementReadyBuff: Buff = {
    name: "Atonement Ready",
    selfOnly: true,
    effects: {
        // Allows usage of Atonement
    },
    appliesTo: ability => ability.name === "Atonement",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 1902,
};

export const SupplicationReadyBuff: Buff = {
    name: "Supplication Ready",
    selfOnly: true,
    effects: {
        // Allows usage of Supplication
    },
    appliesTo: ability => ability.name === "Supplication",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3827,
};

export const SepulchreReadyBuff: Buff = {
    name: "Sepulchre Ready",
    selfOnly: true,
    effects: {
        // Allows usage of Sepulchre
    },
    appliesTo: ability => ability.name === "Sepulchre",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3828,
};

export const DivineMightBuff: Buff = {
    name: "Divine Might",
    selfOnly: true,
    effects: {
        // Allows usage of instant cast Holy Spirit
    },
    appliesTo: ability => ability.name === "Holy Spirit",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 2673,
};

export const BladeOfHonorReadyBuff: Buff = {
    name: "Blade of Honor Ready",
    selfOnly: true,
    effects: {
        // Allows usage of Blade of Honor
    },
    appliesTo: ability => ability.name === "Blade of Honor",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3831,
};
