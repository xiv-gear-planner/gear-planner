import {Ability, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import NINGauge from "./nin_gauge";

/** Represents a Ninja-specific Ability */
export type NinAbility = Ability & Readonly<{
    /** Custom function to run to apply gauge updates relating to this ability */
    updateGauge?(gauge: NINGauge): void,
    /** The Ninki cost of this ability */
    ninkiCost?: number,
}>;

/** Represents a Ninja-specific GCD Ability */
export type NinGcdAbility = GcdAbility & NinAbility;

/** Represents a Ninja-specific oGCD Ability */
export type NinOgcdAbility = OgcdAbility & NinAbility;

/** Represents a Mudra Step */
export type MudraStep = NinGcdAbility & Readonly<{
    /** The ability id of the Mudra action that doesn't consume charges */
    noChargeId: number,
}>;

/** Represents a Ninjutsu Ability */
export type NinjutsuAbility = NinGcdAbility & Readonly<{
    /** The mudra combination for this Ninjutsu */
    steps: MudraStep[],
}>;

/** Represents an Ability that costs Ninki */
export type NinkiAbility = NinOgcdAbility & Readonly<{
    /** The Ninki cost of this ability */
    ninkiCost: number,
}>;

/** Represents the Ninja gauge state */
export type NINGaugeState = {
    level: number,
    ninki: number,
    kazematoi: number,
}

/** Represents the extra data for UsedAbility */
export type NINExtraData = {
    /** The Ninja gauge data */
    gauge: NINGaugeState,
};