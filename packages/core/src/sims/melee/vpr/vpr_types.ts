import {Ability, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {VprGauge} from "./vpr_gauge";

// This file is broadly copied as needed from NIN

/** A Viper-specific ability. */
export type VprAbility = Ability & Readonly<{

    /** Run if an ability needs to update the serpent offerings gauge */
    updateGaugeLegacy?(gauge: VprGauge): void;

}>

export type VprGcdAbility = GcdAbility & VprAbility;

export type VprOgcdAbility = OgcdAbility & VprAbility;

/** Represents the Viper gauge state */
export type VprGaugeState = {
    level: number,
    serpentOfferings: number,
    rattlingCoils: number,
}

/** Represents the extra data for UsedAbility */
export type VprExtraData = {
    /** The Viper gauge data */
    gauge: VprGaugeState,

};
