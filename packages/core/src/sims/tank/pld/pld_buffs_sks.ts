import {Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {removeSelf} from "@xivgear/core/sims/common/utils";

// Add a simple function to remove a single stack of a buff, for use with Req:
export function subtractStackSelf(controller: BuffController): void {
    controller.subtractStacksSelf(1);
}

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
        // Buffs PLD Spell Combo but at the level we're considering this
        // Isn't important for us.
    },
    duration: 30,
    statusId: 1368,
    stacks: 4,
    appliesTo: ability => ability.attackType === "Spell",
    beforeSnapshot: subtractStackSelf,
};
export const GoringBladeReadyBuff: Buff = {
    name: "Goring Blade Ready",
    selfOnly: true,
    effects: {
        // Let's us Goring Blade
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
        // Just lets us use Atonement
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
        // Just lets us use Supplication
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
        // Just lets us use Sepulchre
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
        // Just lets us use Insta Cast Holy Spirit
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
        // Just lets us use Blade of Honor
    },
    appliesTo: ability => ability.name === "Blade of Honor",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3831,
};
