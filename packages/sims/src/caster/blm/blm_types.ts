import {Ability, GcdAbility, OgcdAbility, Buff, BuffController, HasGaugeUpdate, HasGaugeCondition} from "@xivgear/core/sims/sim_types";
import {BlmGaugeManager} from "./blm_gauge";

export enum BlmElement {
    Fire = 'Fire',
    Ice = 'Ice',
    Thunder = 'Thunder',
    Unaspected = 'Unaspected'
};

/** A BLM-specific ability. */
export type BlmAbility = Ability & Readonly<{
    /** The element (fire, ice, thunder, unaspected). Not all abilities have an element. */
    element?: BlmElement;
}>;

export type BlmGcdAbility = GcdAbility & BlmAbility & HasGaugeUpdate<BlmGaugeManager> & HasGaugeCondition<BlmGaugeManager>;

export type BlmOgcdAbility = OgcdAbility & BlmAbility;

/** Represents the BLM gauge state */
export type BlmGaugeState = {
    level: number,
    element: BlmElement,
    elementLevel?: number,
    umbralHearts: number,
    magicPoints: number,
    polyglot: number,
    paradox: boolean,
    astralSoul: number,
}

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
                updateGauge: (gauge: BlmGaugeManager) => {
                    gauge.giveAstralFire(3);
                },
                gaugeConditionSatisfied: (gauge: BlmGaugeManager): boolean => {
                    return gauge.firestarter;
                },
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
