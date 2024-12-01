import {OriginCdAbility, SharedCdAbility} from "@xivgear/core/sims/sim_types";
import {StarryMuse} from "@xivgear/core/sims/buffs";
import PCTGauge from "./pct_gauge";
import * as Buffs from "./pct_buffs";
import * as Consts from "./pct_consts";
import {PctGcdAbility, PctOgcdAbility, PctPaletteAbility, PctPaintAbility} from "./pct_types";

export const Red : PctGcdAbility = {
    type: 'gcd',
    name: "Fire in Red",
    id: Consts.RedID,
    attackType: "Spell",
    potency: 440,
    gcd: 2.5,
    cast: 1.5,
    activatesBuffs: [Buffs.AetherhuesGYBuff],
    updateGauge: (gauge: PCTGauge) => {},
};
export const Green : PctGcdAbility = {
    type: 'gcd',
    name: "Aero in Green",
    id: Consts.GreenID,
    attackType: "Spell",
    potency: 480,
    gcd: 2.5,
    cast: 1.5,
    activatesBuffs: [Buffs.AetherhuesBMBuff],
    updateGauge: (gauge: PCTGauge) => {},
};
export const Blue : PctGcdAbility = {
    type: 'gcd',
    name: "Water in Blue",
    id: Consts.BlueID,
    attackType: "Spell",
    potency: 520,
    gcd: 2.5,
    cast: 1.5,
    updateGauge: (gauge: PCTGauge) => {
        if (gauge.level > 60) {
            gauge.paletteGauge += 25;
        }
        if (gauge.level > 80) {
            gauge.whitePaintCharges += 1;
        }
    },
};

export const Cyan : PctGcdAbility = {
    type: 'gcd',
    name: "Blizzard in Cyan",
    id: Consts.CyanID,
    attackType: "Spell",
    potency: 800,
    gcd: 3.3,
    cast: 2.3,
    activatesBuffs: [Buffs.AetherhuesGYBuff],
    updateGauge: (gauge: PCTGauge) => {},
};
export const Yellow : PctGcdAbility = {
    type: 'gcd',
    name: "Stone in Yellow",
    id: Consts.YellowID,
    attackType: "Spell",
    potency: 840,
    gcd: 3.3,
    cast: 2.3,
    activatesBuffs: [Buffs.AetherhuesBMBuff],
    updateGauge: (gauge: PCTGauge) => {},
};
export const Magenta : PctGcdAbility = {
    type: 'gcd',
    name: "Thunder in Magenta",
    id: Consts.MagentaID,
    attackType: "Spell",
    potency: 880,
    gcd: 3.3,
    cast: 2.3,
    updateGauge: (gauge: PCTGauge) => {
        if (gauge.level > 80) {
            gauge.whitePaintCharges += 1;
        }
    },
};

export const Holy : PctPaintAbility = {
    type: 'gcd',
    name: "Holy in White",
    id: Consts.HolyID,
    attackType: "Spell",
    potency: 520,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.34,
    paintCost: 1,
    updateGauge: gauge => gauge.whitePaintCharges -= 1,
};
export const Comet : PctPaintAbility = {
    type: 'gcd',
    name: "Comet in Black",
    id: Consts.CometID,
    attackType: "Spell",
    potency: 880,
    gcd: 3.3,
    cast: 0,
    appDelay: 1.87,
    paintCost: 1,
    updateGauge: gauge => gauge.whitePaintCharges -= 1,
};

export const RainbowDrip : PctGcdAbility = {
    type: 'gcd',
    name: "Rainbow Drip",
    id: Consts.RainbowDripID,
    attackType: "Spell",
    potency: 1000,
    gcd: 6,
    cast: 4,
    appDelay: 1.24,
    updateGauge: gauge => gauge.whitePaintCharges += 1,
};

export const StarPrism : PctGcdAbility = {
    type: 'gcd',
    name: "Star Prism",
    id: Consts.StarPrismID,
    attackType: "Spell",
    potency: 1400,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.25,
    updateGauge: gauge => (gauge: PCTGauge) => {},
};

// TODO : Add logic to simplify the Creature motif into a single action.
export const PomMotif : PctGcdAbility = {
    type: 'gcd',
    name: "Pom Motif",
    id: Consts.PomMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    updateGauge: (gauge: PCTGauge) => {},
};
export const WingMotif : PctGcdAbility = {
    type: 'gcd',
    name: "Wing Motif",
    id: Consts.WingMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    updateGauge: (gauge: PCTGauge) => {},
};
export const ClawMotif : PctGcdAbility = {
    type: 'gcd',
    name: "Claw Motif",
    id: Consts.ClawMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    updateGauge: (gauge: PCTGauge) => {},
};
export const MawMotif : PctGcdAbility = {
    type: 'gcd',
    name: "Maw Motif",
    id: Consts.MawMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    updateGauge: (gauge: PCTGauge) => {},
};
export const HammerMotif : PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Motif",
    id: Consts.HammerMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    updateGauge: (gauge: PCTGauge) => {},
};
export const StarryMotif : PctGcdAbility = {
    type: 'gcd',
    name: "Starry Sky Motif",
    id: Consts.StarryMotifID,
    attackType: "Spell",
    potency: null,
    gcd: 4.0,
    cast: 3.0,
    updateGauge: (gauge: PCTGauge) => {},
};

export const Mog : PctOgcdAbility & OriginCdAbility = {
    type: 'ogcd',
    name: "Mog of the Ages",
    id: Consts.MogID,
    attackType: "Ability",
    potency: 1300,
    appDelay: 1.15,
    cooldown: {
        time: 30,
    },
    updateGauge: (gauge: PCTGauge) => {},
};
export const Madeen : PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Retribution of the Madeen",
    id: Consts.MadeenID,
    attackType: "Ability",
    potency: 1400,
    appDelay: 1.3,
    cooldown: {
        time: 30,
        sharesCooldownWith: Mog,
    },
    updateGauge: (gauge: PCTGauge) => {},
};
// TODO: Since all creature Muses are the same potency and effect (other than the buff) can these be collapsed into a single action?
export const Pom : PctOgcdAbility & OriginCdAbility = {
    type: 'ogcd',
    name: "Pom Muse",
    id: Consts.PomMuseID,
    attackType: "Ability",
    potency: 1100,
    cooldown: {
        time: 40,
        charges: 3,
    },
    updateGauge: (gauge: PCTGauge) => {},
};
export const Wing : PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Winged Muse",
    id: Consts.WingMuseID,
    attackType: "Ability",
    potency: 1100,
    appDelay: 0.98,
    cooldown: {
        time: 40,
        charges: 3,
        sharesCooldownWith: Pom,
    },
    updateGauge: (gauge: PCTGauge) => {},
};
export const Claw : PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Clawed Muse",
    id: Consts.ClawMuseID,
    attackType: "Ability",
    potency: 1100,
    appDelay: 0.98,
    cooldown: {
        time: 40,
        charges: 3,
        sharesCooldownWith: Pom,
    },
    updateGauge: (gauge: PCTGauge) => {},
};
export const Fang : PctOgcdAbility & SharedCdAbility = {
    type: 'ogcd',
    name: "Fanged Muse",
    id: Consts.FangMuseID,
    attackType: "Ability",
    potency: 1100,
    appDelay: 1.16,
    cooldown: {
        time: 40,
        charges: 3,
        sharesCooldownWith: Pom,
    },
    updateGauge: (gauge: PCTGauge) => {},
};

export const Striking : PctOgcdAbility = {
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
    updateGauge: (gauge: PCTGauge) => {},
};

export const Starry : PctOgcdAbility = {
    type: 'ogcd',
    name: "Starry Muse",
    id: Consts.StarryMuseID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [
        Buffs.HyperphantasiaBuff,
        Buffs.RainbowBrightBuff,
        Buffs.SubtractiveSpectrumBuff,
        StarryMuse,
    ],
    updateGauge: (gauge: PCTGauge) => {},
    cooldown: {
        time: 120,
    },
};

export const SubtractivePalette : PctPaletteAbility = {
    type: 'ogcd',
    name: "Subtractive Palette",
    id: Consts.SubtractivePaletteID,
    attackType: "Ability",
    potency: null,
    activatesBuffs: [Buffs.SubtractivePaletteBuff, Buffs.MonochromeBuff],
    paletteCost: 50,
    updateGauge: gauge => gauge.paletteGauge -= 50,
};

// TODO: Add the hidden buffs for tracking the Hammer Combo since it doens't
//       drop when the hammer stamp buff drops.
export const HStamp : PctGcdAbility = {
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
    updateGauge: (gauge: PCTGauge) => {},
};
export const HBrush : PctGcdAbility = {
    type: 'gcd',
    name: "Hammer Brush",
    id: Consts.HBrushID,
    attackType: "Spell",
    potency: 620,
    gcd: 2.5,
    cast: 0,
    appDelay: 1.25,
    autoDh: true,
    autoCrit: true,
    updateGauge: (gauge: PCTGauge) => {},
};
export const HPolish : PctGcdAbility = {
    type: 'gcd',
    name: "Polishing Hammer",
    id: Consts.HPolishID,
    attackType: "Spell",
    potency: 680,
    gcd: 2.5,
    cast: 0,
    appDelay: 2.1,
    autoDh: true,
    autoCrit: true,
    updateGauge: (gauge: PCTGauge) => {},
};
