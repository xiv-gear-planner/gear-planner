import {OriginCdAbility, SharedCdAbility} from "@xivgear/core/sims/sim_types";
import {StarryMuse} from "@xivgear/sims/buffs";
import * as Buffs from "./pct_buffs";
import * as Consts from "./pct_consts";
import {PctCreatureMotif, PctGcdAbility, PctOgcdAbility} from "./pct_types";
import {PctGaugeManager} from "./pct_gauge";

/**
 * Pictomancer actions.
 *
 * Base values are those of the level at which the action is learned. Trait upgrades are expressed as level
 * modifiers. Since only the highest applicable modifier is applied, each one restates everything that differs
 * from the base at that level. Potencies are the Patch 7.55 values, verified against live game data.
 *
 * Potency traits: Pictomancy Mastery (54), II (74), III (84), IV (94).
 * Gauge traits: Palette Gauge (60), Enhanced Artistry (80, white paint), Enhanced Palette (90, Monochrome Tones).
 * Other traits: Enhanced Pictomancy (82, Hyperphantasia), II (86, hammer combo and second Striking Muse charge),
 * III (92, Rainbow Bright), IV (96, third Living Muse charge, Claw and Maw), V (100, Starstruck).
 */

const gainPalette = (gauge: PctGaugeManager) => {
    gauge.palette += 25;
};

const gainPaletteAndPaint = (gauge: PctGaugeManager) => {
    gauge.palette += 25;
    gauge.paint += 1;
};

const gainPaint = (gauge: PctGaugeManager) => {
    gauge.paint += 1;
};

export const Red: PctGcdAbility = {
    type: 'gcd',
    name: "Fire in Red",
    id: Consts.RedID,
    attackType: "Spell",
    potency: 250,
    gcd: 2.5,
    cast: 1.5,
    appDelay: 0.84,
    activatesBuffs: [Buffs.AetherhuesGYBuff],
    levelModifiers: [
        {minLevel: 54, potency: 310},
        {minLevel: 74, potency: 380},
        {minLevel: 84, potency: 420},
        {minLevel: 94, potency: 490},
    ],
};

export const Green: PctGcdAbility = {
    type: 'gcd',
    name: "Aero in Green",
    id: Consts.GreenID,
    attackType: "Spell",
    potency: 280,
    gcd: 2.5,
    cast: 1.5,
    appDelay: 0.89,
    activatesBuffs: [Buffs.AetherhuesBMBuff],
    levelModifiers: [
        {minLevel: 54, potency: 350},
        {minLevel: 74, potency: 420},
        {minLevel: 84, potency: 460},
        {minLevel: 94, potency: 530},
    ],
};

export const Blue: PctGcdAbility = {
    type: 'gcd',
    name: "Water in Blue",
    id: Consts.BlueID,
    attackType: "Spell",
    potency: 320,
    gcd: 2.5,
    cast: 1.5,
    appDelay: 0.98,
    levelModifiers: [
        {minLevel: 54, potency: 390},
        {minLevel: 60, potency: 390, updateGauge: gainPalette},
        {minLevel: 74, potency: 460, updateGauge: gainPalette},
        {minLevel: 80, potency: 460, updateGauge: gainPaletteAndPaint},
        {minLevel: 84, potency: 500, updateGauge: gainPaletteAndPaint},
        {minLevel: 94, potency: 570, updateGauge: gainPaletteAndPaint},
    ],
};

export const Cyan: PctGcdAbility = {
    type: 'gcd',
    name: "Blizzard in Cyan",
    id: Consts.CyanID,
    attackType: "Spell",
    potency: 560,
    gcd: 3.3,
    cast: 2.3,
    appDelay: 0.75,
    activatesBuffs: [Buffs.AetherhuesGYBuff],
    levelModifiers: [
        {minLevel: 74, potency: 680},
        {minLevel: 84, potency: 750},
        {minLevel: 94, potency: 860},
    ],
};

export const Yellow: PctGcdAbility = {
    type: 'gcd',
    name: "Stone in Yellow",
    id: Consts.YellowID,
    attackType: "Spell",
    potency: 600,
    gcd: 3.3,
    cast: 2.3,
    appDelay: 0.80,
    activatesBuffs: [Buffs.AetherhuesBMBuff],
    levelModifiers: [
        {minLevel: 74, potency: 720},
        {minLevel: 84, potency: 790},
        {minLevel: 94, potency: 900},
    ],
};

export const Magenta: PctGcdAbility = {
    type: 'gcd',
    name: "Thunder in Magenta",
    id: Consts.MagentaID,
    attackType: "Spell",
    potency: 640,
    gcd: 3.3,
    cast: 2.3,
    appDelay: 0.85,
    levelModifiers: [
        {minLevel: 74, potency: 760},
        {minLevel: 80, potency: 760, updateGauge: gainPaint},
        {minLevel: 84, potency: 830, updateGauge: gainPaint},
        {minLevel: 94, potency: 940, updateGauge: gainPaint},
    ],
};

export const Holy: PctGcdAbility = {
    type: 'gcd',
    name: "Holy in White",
    id: Consts.HolyID,
    attackType: "Spell",
    potency: 460,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.34,
    updateGauge: gauge => gauge.useWhitePaint(),
    levelModifiers: [
        {minLevel: 84, potency: 500},
        {minLevel: 94, potency: 570},
    ],
};

export const Comet: PctGcdAbility = {
    type: 'gcd',
    name: "Comet in Black",
    id: Consts.CometID,
    attackType: "Spell",
    potency: 830,
    gcd: 3.3,
    cast: 0,
    appDelay: 1.87,
    updateGauge: gauge => gauge.useBlackPaint(),
    levelModifiers: [
        {minLevel: 94, potency: 940},
    ],
};

export const RainbowDrip: PctGcdAbility = {
    type: 'gcd',
    name: "Rainbow Drip",
    id: Consts.RainbowDripID,
    attackType: "Spell",
    potency: 1000,
    gcd: 6,
    cast: 4,
    appDelay: 1.24,
    updateGauge: gainPaint,
};

export const StarPrism: PctGcdAbility = {
    type: 'gcd',
    name: "Star Prism",
    id: Consts.StarPrismID,
    attackType: "Spell",
    potency: 1100,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.25,
};

// Motifs. Their cast and recast times are not affected by spell speed.

export const PomMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Pom Motif",
    id: Consts.PomMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    fixedGcd: true,
    updateGauge: gauge => gauge.paintCreatureMotif('pom'),
};

export const WingMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Wing Motif",
    id: Consts.WingMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    fixedGcd: true,
    updateGauge: gauge => gauge.paintCreatureMotif('wing'),
};

export const ClawMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Claw Motif",
    id: Consts.ClawMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    fixedGcd: true,
    updateGauge: gauge => gauge.paintCreatureMotif('claw'),
};

export const MawMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Maw Motif",
    id: Consts.MawMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    fixedGcd: true,
    updateGauge: gauge => gauge.paintCreatureMotif('maw'),
};

export const HammerMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Motif",
    id: Consts.HammerMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    fixedGcd: true,
    updateGauge: gauge => {
        gauge.hammerCanvas = true;
    },
};

export const StarryMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Starry Sky Motif",
    id: Consts.StarryMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    fixedGcd: true,
    updateGauge: gauge => {
        gauge.starryCanvas = true;
    },
};

// Portraits

export const Mog: PctOgcdAbility & OriginCdAbility = {
    type: 'ogcd',
    name: "Mog of the Ages",
    id: Consts.MogID,
    attackType: "Ability",
    potency: 500,
    appDelay: 1.15,
    cooldown: {
        time: 30,
    },
    updateGauge: gauge => gauge.usePortrait(),
    levelModifiers: [
        {minLevel: 54, potency: 800},
        {minLevel: 84, potency: 1000},
    ],
};

export const Madeen: PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Retribution of the Madeen",
    id: Consts.MadeenID,
    attackType: "Ability",
    potency: 1100,
    appDelay: 1.30,
    cooldown: {
        time: 30,
        sharesCooldownWith: Mog,
    },
    updateGauge: gauge => gauge.usePortrait(),
};

// Living Muses

export const PomMuse: PctOgcdAbility & OriginCdAbility = {
    type: 'ogcd',
    name: "Pom Muse",
    id: Consts.PomMuseID,
    attackType: "Ability",
    potency: 400,
    appDelay: 0.62,
    cooldown: {
        time: 40,
        charges: 2,
    },
    updateGauge: gauge => gauge.useCreatureMuse(),
    levelModifiers: [
        {minLevel: 54, potency: 700},
        {minLevel: 84, potency: 800},
        {minLevel: 96, potency: 800, cooldown: {time: 40, charges: 3}},
    ],
};

export const WingedMuse: PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Winged Muse",
    id: Consts.WingMuseID,
    attackType: "Ability",
    potency: 400,
    appDelay: 0.98,
    cooldown: {
        time: 40,
        charges: 2,
        sharesCooldownWith: PomMuse,
    },
    updateGauge: gauge => gauge.useCreatureMuse(),
    levelModifiers: [
        {minLevel: 54, potency: 700},
        {minLevel: 84, potency: 800},
        {minLevel: 96, potency: 800, cooldown: {time: 40, charges: 3, sharesCooldownWith: PomMuse}},
    ],
};

export const ClawedMuse: PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Clawed Muse",
    id: Consts.ClawMuseID,
    attackType: "Ability",
    potency: 800,
    appDelay: 0.98,
    cooldown: {
        time: 40,
        charges: 3,
        sharesCooldownWith: PomMuse,
    },
    updateGauge: gauge => gauge.useCreatureMuse(),
};

export const FangedMuse: PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Fanged Muse",
    id: Consts.FangMuseID,
    attackType: "Ability",
    potency: 800,
    appDelay: 1.16,
    cooldown: {
        time: 40,
        charges: 3,
        sharesCooldownWith: PomMuse,
    },
    updateGauge: gauge => gauge.useCreatureMuse(),
};

export const CreatureMotifs: Record<PctCreatureMotif, PctGcdAbility> = {
    pom: PomMotif,
    wing: WingMotif,
    claw: ClawMotif,
    maw: MawMotif,
};

export const CreatureMuses: Record<PctCreatureMotif, PctOgcdAbility> = {
    pom: PomMuse,
    wing: WingedMuse,
    claw: ClawedMuse,
    maw: FangedMuse,
};

export const StrikingMuse: PctOgcdAbility = {
    type: 'ogcd',
    name: "Striking Muse",
    id: Consts.StrikingMuseID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [Buffs.HammerTimeBuff],
    cooldown: {
        time: 60,
        charges: 1,
    },
    updateGauge: gauge => {
        gauge.hammerCanvas = false;
    },
    levelModifiers: [
        {minLevel: 86, cooldown: {time: 60, charges: 2}},
    ],
};

export const StarryMuseAction: PctOgcdAbility = {
    type: 'ogcd',
    name: "Starry Muse",
    id: Consts.StarryMuseID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [
        StarryMuse,
        Buffs.SubtractiveSpectrumBuff,
    ],
    cooldown: {
        time: 120,
    },
    updateGauge: gauge => {
        gauge.starryCanvas = false;
    },
    levelModifiers: [
        {
            minLevel: 82,
            activatesBuffs: [StarryMuse, Buffs.SubtractiveSpectrumBuff, Buffs.HyperphantasiaBuffNoRainbow],
        },
        {
            minLevel: 92,
            activatesBuffs: [StarryMuse, Buffs.SubtractiveSpectrumBuff, Buffs.HyperphantasiaBuff],
        },
        {
            minLevel: 100,
            activatesBuffs: [StarryMuse, Buffs.SubtractiveSpectrumBuff, Buffs.HyperphantasiaBuff, Buffs.StarstruckBuff],
        },
    ],
};

export const SubtractivePalette: PctOgcdAbility = {
    type: 'ogcd',
    name: "Subtractive Palette",
    id: Consts.SubtractivePaletteID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [Buffs.SubtractivePaletteBuff],
    updateGauge: gauge => gauge.useSubtractivePalette(false),
    levelModifiers: [
        {minLevel: 90, updateGauge: (gauge: PctGaugeManager) => gauge.useSubtractivePalette(true)},
    ],
};

/**
 * Subtractive Palette as used under Subtractive Spectrum, i.e. without the palette cost.
 */
export const FreeSubtractivePalette: PctOgcdAbility = {
    ...SubtractivePalette,
    updateGauge: gauge => gauge.useFreeSubtractivePalette(false),
    levelModifiers: [
        {minLevel: 90, updateGauge: (gauge: PctGaugeManager) => gauge.useFreeSubtractivePalette(true)},
    ],
};

// Hammer combo

export const HammerStamp: PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Stamp",
    id: Consts.HStampID,
    attackType: "Spell",
    potency: 300,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.38,
    autoDh: true,
    autoCrit: true,
    levelModifiers: [
        {minLevel: 54, potency: 420},
        {minLevel: 74, potency: 500},
        {minLevel: 84, potency: 540},
        {minLevel: 94, potency: 560},
    ],
};

export const HammerBrush: PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Brush",
    id: Consts.HBrushID,
    attackType: "Spell",
    potency: 560,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.25,
    autoDh: true,
    autoCrit: true,
    levelModifiers: [
        {minLevel: 94, potency: 580},
    ],
};

export const PolishingHammer: PctGcdAbility = {
    type: 'gcd',
    name: "Polishing Hammer",
    id: Consts.HPolishID,
    attackType: "Spell",
    potency: 580,
    gcd: 2.5,
    cast: 0,
    appDelay: 2.10,
    autoDh: true,
    autoCrit: true,
    levelModifiers: [
        {minLevel: 94, potency: 600},
    ],
};

/**
 * The hammer combo, in order.
 */
export const HammerCombo: readonly PctGcdAbility[] = [HammerStamp, HammerBrush, PolishingHammer];
