import type {Ability, AutoAttack, GcdAbility, OgcdAbility, PreDmgUsedAbility} from "../../sim_types";
import type {MchGauge} from "./mch_gauge";

interface MchSpecificFields {
    updateGauge?: (gauge: MchGauge) => void
}

/** Represents a MCH-specific action */
export type MchAbility = Ability & MchSpecificFields;

/** Represents a MCH-specific GCD action */
export type MchGcdAbility = GcdAbility & MchAbility;

/** Represents a MCH-specific oGCD action */
export type MchOgcdAbility = OgcdAbility & MchAbility;

/** Used ability definition with added extra data. Used in the GUI. */
export interface MchPreDmgUsedAbility extends PreDmgUsedAbility {
    extraData: {
        gauge: {
            heat: number,
            battery: number,
        },
    }
}
