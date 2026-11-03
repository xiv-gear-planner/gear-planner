import {OriginCdAbility, SharedCdAbility} from "@xivgear/core/sims/sim_types";
import {StarryMuse} from "@xivgear/sims/buffs";
import * as Buffs from "./pct_buffs";
import * as Consts from "./pct_consts";
import {PctCreatureMotif, PctGcdAbility, PctOgcdAbility} from "./pct_types";

/**
 * Pictomancer actions. Potencies are the level 100 values as of Patch 7.55 (verified against live game data):
 * the 7.2 rebalance lowered the muses, portraits and Star Prism, and 7.3 adjusted the filler spells, Holy in
 * White, Comet in Black and the hammer combo to their current values.
 */

export const Red: PctGcdAbility = {
    type: 'gcd',
    name: "Fire in Red",
    id: Consts.RedID,
    attackType: "Spell",
    potency: 490,
    gcd: 2.5,
    cast: 1.5,
    appDelay: 0.84,
    activatesBuffs: [Buffs.AetherhuesGYBuff],
};

export const Green: PctGcdAbility = {
    type: 'gcd',
    name: "Aero in Green",
    id: Consts.GreenID,
    attackType: "Spell",
    potency: 530,
    gcd: 2.5,
    cast: 1.5,
    appDelay: 0.89,
    activatesBuffs: [Buffs.AetherhuesBMBuff],
};

export const Blue: PctGcdAbility = {
    type: 'gcd',
    name: "Water in Blue",
    id: Consts.BlueID,
    attackType: "Spell",
    potency: 570,
    gcd: 2.5,
    cast: 1.5,
    appDelay: 0.98,
    updateGauge: gauge => {
        gauge.palette += 25;
        gauge.paint += 1;
    },
};

export const Cyan: PctGcdAbility = {
    type: 'gcd',
    name: "Blizzard in Cyan",
    id: Consts.CyanID,
    attackType: "Spell",
    potency: 860,
    gcd: 3.3,
    cast: 2.3,
    appDelay: 0.75,
    activatesBuffs: [Buffs.AetherhuesGYBuff],
};

export const Yellow: PctGcdAbility = {
    type: 'gcd',
    name: "Stone in Yellow",
    id: Consts.YellowID,
    attackType: "Spell",
    potency: 900,
    gcd: 3.3,
    cast: 2.3,
    appDelay: 0.80,
    activatesBuffs: [Buffs.AetherhuesBMBuff],
};

export const Magenta: PctGcdAbility = {
    type: 'gcd',
    name: "Thunder in Magenta",
    id: Consts.MagentaID,
    attackType: "Spell",
    potency: 940,
    gcd: 3.3,
    cast: 2.3,
    appDelay: 0.85,
    updateGauge: gauge => {
        gauge.paint += 1;
    },
};

export const Holy: PctGcdAbility = {
    type: 'gcd',
    name: "Holy in White",
    id: Consts.HolyID,
    attackType: "Spell",
    potency: 570,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.34,
    updateGauge: gauge => gauge.useWhitePaint(),
};

export const Comet: PctGcdAbility = {
    type: 'gcd',
    name: "Comet in Black",
    id: Consts.CometID,
    attackType: "Spell",
    potency: 940,
    gcd: 3.3,
    cast: 0,
    appDelay: 1.87,
    updateGauge: gauge => gauge.useBlackPaint(),
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
    updateGauge: gauge => {
        gauge.paint += 1;
    },
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

// Motifs

export const PomMotif: PctGcdAbility = {
    type: 'gcd',
    name: "Pom Motif",
    id: Consts.PomMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
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
    potency: 1000,
    appDelay: 1.15,
    cooldown: {
        time: 30,
    },
    updateGauge: gauge => gauge.usePortrait(),
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
    potency: 800,
    appDelay: 0.62,
    cooldown: {
        time: 40,
        charges: 3,
    },
    updateGauge: gauge => gauge.useCreatureMuse(),
};

export const WingedMuse: PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Winged Muse",
    id: Consts.WingMuseID,
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
        charges: 2,
    },
    updateGauge: gauge => {
        gauge.hammerCanvas = false;
    },
};

export const StarryMuseAction: PctOgcdAbility = {
    type: 'ogcd',
    name: "Starry Muse",
    id: Consts.StarryMuseID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [
        StarryMuse,
        Buffs.HyperphantasiaBuff,
        Buffs.StarstruckBuff,
        Buffs.SubtractiveSpectrumBuff,
    ],
    cooldown: {
        time: 120,
    },
    updateGauge: gauge => {
        gauge.starryCanvas = false;
    },
};

export const SubtractivePalette: PctOgcdAbility = {
    type: 'ogcd',
    name: "Subtractive Palette",
    id: Consts.SubtractivePaletteID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [Buffs.SubtractivePaletteBuff],
    updateGauge: gauge => gauge.useSubtractivePalette(),
};

/**
 * Subtractive Palette as used under Subtractive Spectrum, i.e. without the palette cost.
 */
export const FreeSubtractivePalette: PctOgcdAbility = {
    ...SubtractivePalette,
    updateGauge: gauge => gauge.useFreeSubtractivePalette(),
};

// Hammer combo

export const HammerStamp: PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Stamp",
    id: Consts.HStampID,
    attackType: "Spell",
    potency: 560,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.38,
    autoDh: true,
    autoCrit: true,
};

export const HammerBrush: PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Brush",
    id: Consts.HBrushID,
    attackType: "Spell",
    potency: 580,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.25,
    autoDh: true,
    autoCrit: true,
};

export const PolishingHammer: PctGcdAbility = {
    type: 'gcd',
    name: "Polishing Hammer",
    id: Consts.HPolishID,
    attackType: "Spell",
    potency: 600,
    gcd: 2.5,
    cast: 0,
    appDelay: 2.10,
    autoDh: true,
    autoCrit: true,
};

/**
 * The hammer combo, in order.
 */
export const HammerCombo: readonly PctGcdAbility[] = [HammerStamp, HammerBrush, PolishingHammer];
