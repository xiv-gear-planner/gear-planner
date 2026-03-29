import {Ability, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import PCTGauge from "./pct_gauge";

export type PctAbility = Ability & Readonly<{
    /** Custom function to run to apply gauge updates relating to this ability */
    updateGauge?(gauge: PCTGauge): void,
    /** The Palette cost of this ability */
    paletteCost?: number,
    /** The White paint cost of this ability */
    whitePaintCost?: number,
}>;

/** Represents a Pictomancer-specific GCD Ability */
export type PctGcdAbility = GcdAbility & PctAbility;

/** Represents a Pictomancer-specific oGCD Ability */
export type PctOgcdAbility = OgcdAbility & PctAbility;

/** Represens the Pictomancer gauge state */
export type PCTGaugeState = {
    level: number,
    palette: number,
    whitePaint: number,
    hyperphantasia: number
};

export type PctPaletteAbility = PctOgcdAbility & Readonly<{
    /** The Palette cost of the ability */
    paletteCost: number,
}>;

export type PctPaintAbility = PctGcdAbility & Readonly <{
    /** The white paint cost of the ability */
    paintCost: number,
}>;
