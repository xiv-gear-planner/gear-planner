import { Ability, GcdAbility, OgcdAbility } from "@xivgear/core/sims/sim_types";
import SAMGauge from "./sam_gauge";

/** Represents a Samurai-specific Ability */
export type SamAbility = Ability & Readonly<{
    /** Custom function to run to apply gauge updates relating to this ability */
    updateGauge?(gauge: SAMGauge): void,
    /** The Kenki cost of this ability */
    kenkiCost?: number,
}>;

/** Represents a Ninja-specific GCD Ability */
export type SamGcdAbility = GcdAbility & SamAbility;

/** Represents a Ninja-specific oGCD Ability */
export type SamOgcdAbility = OgcdAbility & SamAbility;

/** Represents an Ability that costs Kenki */
export type KenkiAbility = SamOgcdAbility & Readonly<{
    /** The Kenki cost of this ability */
    kenkiCost: number,
}>;

/** Represents the Samurai gauge state */
export type SAMGaugeState = {
    level: number,
    sen: Set<string>,
    kenki: number,
    meditation: number,
}

/** Represents the extra data for UsedAbility */
export type SAMExtraData = {
    /** The Samurai gauge data */
    gauge: SAMGaugeState,
};