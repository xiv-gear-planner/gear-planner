import { Ability, GcdAbility, OgcdAbility } from "@xivgear/core/sims/sim_types";
import { MNKGauge } from "./mnk_gauge";

/** Represents a Monk-specific Ability */
export type MnkAbility = Ability & Readonly<{
    /** Custom function to run to apply gauge updates relating to this ability */
    updateGauge?(gauge: MNKGauge): void,
}>;

/** Represents a Monk-specific GCD Ability */
export type MnkGcdAbility = GcdAbility & MnkAbility;

/** Represents a Monk-specific oGCD Ability */
export type MnkOgcdAbility = OgcdAbility & MnkAbility;

/** Abilities may cost or gain balls, as well as build beast chakras while blitzing */
export type FuryType = 'opo' | 'raptor' | 'coeurl'

/** Represents the Monk gauge state */
export type MNKGaugeState = {
    critChance?: number,
    chakra: number,
    opoFury: number,
    raptorFury: number,
    coeurlFury: number,
    lunarNadi: number,
    solarNadi: number,
    beastChakra?: FuryType[],
}

/** Represents the extra data for UsedAbility */
export type MNKExtraData = {
    gauge: MNKGaugeState,
};
