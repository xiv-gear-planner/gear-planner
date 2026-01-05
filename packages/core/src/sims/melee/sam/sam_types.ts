import {Ability, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import SAMGauge from "./sam_gauge";

/** Represents a Samurai-specific Ability */
export type SamAbility = Ability & Readonly<{
    /** Custom function to run to apply gauge updates relating to this ability */
    updateGaugeLegacy?(gauge: SAMGauge): void,
    /** The Kenki cost of this ability */
    kenkiCost?: number,
}>;

/** Represents a Samurai-specific GCD Ability */
export type SamGcdAbility = GcdAbility & SamAbility;

/** Represents a Samurai-specific oGCD Ability */
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

/** Represents the Rotation data based on GCD. */
export type SAMRotationData = {
    /** The name of the rotation selected */
    name: string,
    /** The actual rotations selected */
    rotation: {
        /** The opener for the rotation */
        opener: SamAbility[],
        /** The optional rotation loop */
        loop: SamAbility[],
    }
};
