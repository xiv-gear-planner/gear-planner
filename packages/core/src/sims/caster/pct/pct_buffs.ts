import {Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {removeSelf} from "@xivgear/core/sims/common/utils";
import * as Consts from "./pct_consts";

/**
 * Pictomancer-specific buffs.
 */

const HAMMER_ACTIONS: number[] = [
    Consts.HStampID,
    Consts.HBrushID,
    Consts.HPolishID,
];

export const HammerTimeBuff: Buff = {
    name: "Hammer Time",
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Hammer combo GCDs",
    appliesTo: ability => HAMMER_ACTIONS.includes(ability.id),
    beforeSnapshot(controller: BuffController): void {
        controller.subtractStacksSelf(1);
    },
    stacks: 3,
    statusId: 3680,
};

export const RainbowBrightBuff: Buff = {
    name: "Rainbow Bright",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Next Rainbow Drip has no cast time and a reduced recast time.",
    appliesTo: ability => ability.id === Consts.RainbowDripID,
    beforeAbility<PctGcdAbility>(controller: BuffController, ability: PctGcdAbility): PctGcdAbility | null {
        controller.removeStatus(RainbowBrightBuff);
        return {
            ...ability,
            gcd: 2.5,
            cast: 0,
        };
    },
    statusId: 3679,
};

export const StarstruckBuff: Buff = {
    name: "Starstruck",
    duration: 20,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Star Prism",
    appliesTo: ability => ability.id === Consts.StarPrismID,
    beforeSnapshot: removeSelf,
    statusId: 3681,
};

const SUBTRACTIVE_ACTIONS: number[] = [
    Consts.CyanID,
    Consts.YellowID,
    Consts.MagentaID,
];

export const SubtractivePaletteBuff: Buff = {
    name: "Subtractive Palette",
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Subtractive GCDs",
    appliesTo: ability => SUBTRACTIVE_ACTIONS.includes(ability.id),
    beforeSnapshot(controller: BuffController): void {
        controller.subtractStacksSelf(1);
    },
    stacks: 3,
    statusId: 3674,
};

export const MonochromeBuff: Buff = {
    name: "Monochrome Tones",
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Comet in Black",
    appliesTo: ability => ability.id === Consts.CometID,
    beforeSnapshot: removeSelf,
    statusId: 3691,
};

export const SubtractiveSpectrumBuff: Buff = {
    name: "Subtractive Spectrum",
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Subtractive Palette without cost.",
    appliesTo: ability => ability.id === Consts.SubtractivePaletteID,
    beforeAbility<PctPaletteAbility>(controller: BuffController, ability: PctPaletteAbility): PctPaletteAbility {
        controller.removeSelf();
        return {
            ...ability,
            updateGauge: null,
        };
    },
    statusId: 3690,
};

export const AetherhuesGYBuff: Buff = {
    name: "Aetherhues",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to cast green and yellow magicks.",
    appliesTo: ability => (ability.id === Consts.GreenID || ability.id === Consts.YellowID),
    beforeSnapshot: removeSelf,
    statusId: 3675,
};

export const AetherhuesBMBuff: Buff = {
    name: "Aetherhues II",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to cast blue and magenta magicks.",
    appliesTo: ability => (ability.id === Consts.BlueID || ability.id === Consts.MagentaID),
    beforeSnapshot: removeSelf,
    statusId: 3676,
};

const HYPERPHANTASIA_ACTIONS: number[] = [
    // You are going to be very sad when using these.
    Consts.RedID, Consts.GreenID, Consts.BlueID,
    Consts.HolyID,
    // Standard Starry Muse window spells.
    Consts.CyanID, Consts.YellowID, Consts.MagentaID,
    Consts.CometID, Consts.StarPrismID,
];

/**
 * Technically it is the Inspiration buff that grants haste, however, it's
 * easier to just collapse both buffs into a single buff.
 *
 * If it turns out in a future patch that they make inspiration and/or
 * hyperphantasia do more distinct things, then reconsider this.
 */
export const HyperphantasiaBuff: Buff = {
    name: "Hyperphantasia",
    duration: 30,
    effects: {
        haste: 25,
    },
    selfOnly: true,
    descriptionOverride: "Aetherhue spells have reduced cast and recast times.",
    appliesTo: ability => HYPERPHANTASIA_ACTIONS.includes(ability.id),
    beforeAbility<PctGcdAbility>(controller: BuffController, ability: PctGcdAbility): PctGcdAbility {
        controller.subtractStacksSelf(1);
        const activatesBuffs = [];
        if (this.stacks === 0) {
            activatesBuffs.push(RainbowBrightBuff);
        }
        return {
            ...ability,
            activatesBuffs: [...activatesBuffs],
        };
    },
    stacks: 5,
    statusId: 3688,
};
