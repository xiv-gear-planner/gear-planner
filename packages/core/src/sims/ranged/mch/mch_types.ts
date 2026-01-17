import type {Ability, GcdAbility, OgcdAbility} from "../../sim_types";
import type {MchGauge} from "./mch_gauge";

/** Represents a MCH-specific action */
export type MchAbility = Ability & Readonly<{
    updateGauge?: (gauge: MchGauge) => void
}>

/** Represents a MCH-specific GCD action */
export type MchGcdAbility = GcdAbility & MchAbility;

/** Represents a MCH-specific oGCD action */
export type MchOgcdAbility = OgcdAbility & MchAbility;
