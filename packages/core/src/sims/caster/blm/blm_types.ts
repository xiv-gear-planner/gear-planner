import {Ability, GcdAbility, OgcdAbility, Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {BlmGauge} from "./blm_gauge";

/** A BLM-specific ability. */
export type BlmAbility = Ability & Readonly<{
    /** Fire/ice aspected element, undefined if unaspected */
    element?: 'fire' | 'ice';

    /** The polyglot cost of the ability */
    polyglotCost?: number;

    /** For element change, astral soul, and umbral hearts */
    updateGaugeLegacy?(gauge: BlmGauge): void;
}> & {
    /** The MP cost of the ability */
    mp?: number | 'flare' | 'all';
}

export type BlmGcdAbility = GcdAbility & BlmAbility;

export type BlmOgcdAbility = OgcdAbility & BlmAbility;

/** Represents the BLM gauge state */
export type BlmGaugeState = {
    aspect: number,
    umbralHearts: number,
    mp: number,
    polyglot: number,
    paradox: boolean,
    astralSoul: number,
}

/** Represents the extra data for UsedAbility, primarily for consumption in the UI */
export type BlmExtraData = {
    /** The BLM gauge data */
    gauge: BlmGaugeState,
};

export const LeyLinesBuff: Buff = {
    name: "Circle of Power",
    duration: 20,
    selfOnly: true,
    effects: {
        haste: 15,
    },
    statusId: 738,
};

export const FirestarterBuff: Buff = {
    name: "Firestarter",
    selfOnly: true,
    effects: {
        // Removes MP cost and cast time from Fire III
    },
    appliesTo: _ => true,
    beforeAbility<X extends BlmAbility>(buffController: BuffController, ability: X): X {
        if (ability.name === "Fire III") {
            buffController.removeSelf();
            return {
                ...ability,
                id: 30896,
                cast: 0,
                mp: 0,
            };
        }
        return null;
    },
    statusId: 165,
};

export const ThunderheadBuff: Buff = {
    name: "Thunderhead",
    selfOnly: true,
    effects: {
        // Allows casting Thunder spells
    },
    appliesTo: _ => true,
    beforeAbility<X extends BlmAbility>(buffController: BuffController, ability: X): X {
        if (ability.name === "Thunder III" || ability.name === "High Thunder") {
            buffController.removeSelf();
        }
        return null;
    },
    statusId: 3870,
};

export const SwiftcastBuff: Buff = {
    name: "Swiftcast",
    duration: 10,
    selfOnly: true,
    effects: {
        // Removes cast time of the next spell with a cast time
    },
    appliesTo: _ => true,
    beforeAbility<X extends Ability>(buffController: BuffController, ability: X): X | null {
        if (ability.type === 'gcd' && ability.cast > 0) {
            buffController.removeSelf();
            return {
                ...ability,
                cast: 0,
            };
        }
        return null;
    },
    statusId: 167,
};

export const TriplecastBuff: Buff = {
    name: "Triplecast",
    duration: 15,
    selfOnly: true,
    effects: {
        // Removes cast time of the next spell with a cast time
    },
    stacks: 3,
    appliesTo: _ => true,
    beforeAbility<X extends Ability>(buffController: BuffController, ability: X): X | null {
        if (ability.type === 'gcd' && ability.cast > 0) {
            buffController.subtractStacksSelf(1);
            return {
                ...ability,
                cast: 0,
            };
        }
        return null;
    },
    statusId: 1211,
};
