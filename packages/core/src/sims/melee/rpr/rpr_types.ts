import { Ability, GcdAbility, OgcdAbility } from "@xivgear/core/sims/sim_types";
import { RprGauge } from "./rpr_gauge";

// This file is broadly copied as needed from NIN

/** A Reaper-specific ability. */
export type RprAbility = Ability & Readonly<{

    /** Run if an ability needs to update the Soul gauge */
    updateSoulGauge?(gauge: RprGauge): void;

    /** The Soul cost of the ability */
    soulCost?: number;

    /** Run if an ability needs to update the Shroud gauge */
    updateShroudGauge?(gauge: RprGauge): void;

    /** The Shroud cost of the ability */
    shroudCost?: number;

}>

export type RprGcdAbility = GcdAbility & RprAbility;

export type RprOgcdAbility = OgcdAbility & RprAbility;

/** Rpr ability that costs soul */
export type SoulAbility = RprAbility & Readonly<{

    soulCost: number;
}>

/** Rpr ability that costs shroud */
export type ShroudAbility = RprAbility & Readonly<{

    shroudCost: number;
}>

/** Represents the Reaper gauge state */
export type RprGaugeState = {
    level: number,
    soul: number,
    shroud: number,
}

/** Represents the extra data for UsedAbility */
export type RprExtraData = {
    /** The Reaper gauge data */
    gauge: RprGaugeState,
};
