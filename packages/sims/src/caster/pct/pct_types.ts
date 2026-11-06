import {Ability, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {PctGaugeManager} from "./pct_gauge";

/**
 * A Pictomancer-specific ability.
 */
export type PctAbility = Ability & Readonly<{
    /**
     * Custom function to run to apply gauge updates relating to this ability. Runs when the ability snapshots.
     */
    updateGauge?(gauge: PctGaugeManager): void,
}>;

/**
 * Represents a Pictomancer-specific GCD Ability
 */
export type PctGcdAbility = GcdAbility & PctAbility;

/**
 * Represents a Pictomancer-specific oGCD Ability
 */
export type PctOgcdAbility = OgcdAbility & PctAbility;

/**
 * The creature motifs, in the order in which they must be painted.
 */
export const CREATURE_MOTIFS = ['pom', 'wing', 'claw', 'maw'] as const;

export type PctCreatureMotif = typeof CREATURE_MOTIFS[number];

/**
 * The portraits which become available after painting (and using) Wing and Maw respectively.
 */
export type PctPortrait = 'mog' | 'madeen';

/**
 * Represents the Pictomancer gauge state
 */
export type PctGaugeState = {
    level: number,
    /**
     * Palette gauge, 0-100.
     */
    palette: number,
    /**
     * Total paint charges (white + black), 0-5.
     */
    paint: number,
    /**
     * Whether Monochrome Tones is active, i.e. one of the paint charges is (or the next one will be) black.
     */
    monochrome: boolean,
    /**
     * The creature motif currently on the canvas, or null if empty.
     */
    creatureCanvas: PctCreatureMotif | null,
    /**
     * The next creature motif to be painted.
     */
    nextCreature: PctCreatureMotif,
    /**
     * The portrait currently available (Mog of the Ages / Retribution of the Madeen), or null.
     */
    portrait: PctPortrait | null,
    /**
     * Whether the hammer motif is painted.
     */
    hammerCanvas: boolean,
    /**
     * Whether the starry sky motif is painted.
     */
    starryCanvas: boolean,
};
