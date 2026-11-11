import {Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {removeSelf} from "@xivgear/sims/common/utils";
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
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute the Hammer combo",
    appliesTo: ability => HAMMER_ACTIONS.includes(ability.id),
    beforeSnapshot(controller: BuffController): void {
        controller.subtractStacksSelf(1);
    },
    stacks: 3,
    statusId: Consts.HammerTimeStatusID,
};

/**
 * Makes the next Rainbow Drip instant. The reduced recast depends on spell speed in a non-standard way, so it is
 * applied by the cycle processor, which has access to the stats.
 */
export const RainbowBrightBuff: Buff = {
    name: "Rainbow Bright",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Next Rainbow Drip has no cast time and a reduced recast time.",
    appliesTo: ability => ability.id === Consts.RainbowDripID,
    beforeAbility<X>(controller: BuffController, ability: X): X {
        controller.removeSelf();
        return {
            ...ability,
            cast: 0,
        };
    },
    statusId: Consts.RainbowBrightStatusID,
};

export const StarstruckBuff: Buff = {
    name: "Starstruck",
    duration: 20,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Star Prism",
    appliesTo: ability => ability.id === Consts.StarPrismID,
    beforeSnapshot: removeSelf,
    statusId: Consts.StarstruckStatusID,
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
    statusId: Consts.SubtractivePaletteStatusID,
};

/**
 * Grants a free Subtractive Palette. The cost reduction itself is handled by the cycle processor, which swaps
 * in the costless version of the ability when this buff is active.
 */
export const SubtractiveSpectrumBuff: Buff = {
    name: "Subtractive Spectrum",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to execute Subtractive Palette without cost.",
    appliesTo: ability => ability.id === Consts.SubtractivePaletteID,
    beforeSnapshot: removeSelf,
    statusId: Consts.SubtractiveSpectrumStatusID,
};

export const AetherhuesGYBuff: Buff = {
    name: "Aetherhues",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to cast green and yellow magicks.",
    appliesTo: ability => (ability.id === Consts.GreenID || ability.id === Consts.YellowID),
    beforeSnapshot: removeSelf,
    statusId: Consts.AetherhuesStatusID,
};

export const AetherhuesBMBuff: Buff = {
    name: "Aetherhues II",
    duration: 30,
    effects: {},
    selfOnly: true,
    descriptionOverride: "Able to cast blue and magenta magicks.",
    appliesTo: ability => (ability.id === Consts.BlueID || ability.id === Consts.MagentaID),
    beforeSnapshot: removeSelf,
    statusId: Consts.AetherhuesIIStatusID,
};

const HYPERPHANTASIA_ACTIONS: number[] = [
    Consts.RedID, Consts.GreenID, Consts.BlueID,
    Consts.CyanID, Consts.YellowID, Consts.MagentaID,
    Consts.HolyID, Consts.CometID,
    Consts.StarPrismID,
];

/**
 * Technically it is the Inspiration buff that grants the 25% cast/recast reduction, and Hyperphantasia
 * which tracks the five stacks. Since Inspiration ends as soon as the last Hyperphantasia stack is consumed,
 * it is simpler to collapse both into a single stacking buff.
 *
 * @param grantsRainbowBright Whether consuming the final stack grants Rainbow Bright (Enhanced Pictomancy III,
 * level 92).
 */
function makeHyperphantasiaBuff(grantsRainbowBright: boolean): Buff {
    return {
        name: "Hyperphantasia",
        duration: 30,
        effects: {
            haste: 25,
        },
        selfOnly: true,
        descriptionOverride: grantsRainbowBright
            ? "Aetherhue spells have reduced cast and recast times. Consuming all stacks grants Rainbow Bright."
            : "Aetherhue spells have reduced cast and recast times.",
        appliesTo: ability => HYPERPHANTASIA_ACTIONS.includes(ability.id),
        beforeSnapshot<X>(controller: BuffController, ability: X): X | void {
            const isLastStack = (this as Buff).stacks === 1;
            controller.subtractStacksSelf(1);
            if (isLastStack && grantsRainbowBright) {
                const existing = (ability as {activatesBuffs?: readonly Buff[]}).activatesBuffs ?? [];
                return {
                    ...ability,
                    activatesBuffs: [...existing, RainbowBrightBuff],
                };
            }
        },
        stacks: 5,
        statusId: Consts.HyperphantasiaStatusID,
    };
}

/**
 * Hyperphantasia at level 92 and above, where consuming all stacks grants Rainbow Bright.
 */
export const HyperphantasiaBuff: Buff = makeHyperphantasiaBuff(true);

/**
 * Hyperphantasia from level 82 to 91, before Rainbow Bright is available.
 */
export const HyperphantasiaBuffNoRainbow: Buff = makeHyperphantasiaBuff(false);
