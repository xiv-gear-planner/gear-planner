import {Ability, GcdAbility, OgcdAbility, OriginCdAbility, SharedCdAbility} from "@xivgear/core/sims/sim_types";
import {Dokumori} from "@xivgear/core/sims/buffs";
import {TenriJindoReady, KassatsuBuff, BunshinBuff, Higi, MeisuiBuff, KunaisBaneBuff, RaijuReady, PhantomReady, TenChiJinReady, ShadowWalker} from './nin_buffs';
import NINGauge from "./nin_gauge";

/** Information relating to different potencies of an Ability based on level */
export type SyncedPotency = Readonly<{
    /** The min level which this potency adjustment applies to */
    minLevel: number,
    /** The adjusted potency */
    potency: number,
}>;

/** Represents a Ninja-specific Ability */
export type NinAbility = Ability & Readonly<{
    /**
     * Information relating to different potencies of an Ability based on level.
     * This should be ordered from highest level to lowest level as the sim will select the first valid option found.
    */
    syncedPotency?: SyncedPotency[],
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
}>

/** Represents an Ability that costs Ninki */
export type NinkiAbility = NinOgcdAbility & Readonly<{
    /** The Ninki cost of this ability */
    ninkiCost: number,
}>

/**
 * Whether or not this ability is a Ninki spender
 * @param action The ability to check
 */
export function isNinkiAbility(action: NinkiAbility | NinOgcdAbility): action is NinkiAbility {
    return (action as NinkiAbility).ninkiCost !== undefined;
}

/**
 * GCD Actions
 */
export const SpinningEdge: NinGcdAbility = {
    type: 'gcd',
    name: "Spinning Edge",
    id: 2240,
    attackType: "Weaponskill",
    potency: 280,
    syncedPotency: [{
        minLevel: 94,
        potency: 280,
    }, {
        minLevel: 84,
        potency: 220,
    }, {
        minLevel: 1,
        potency: 180
    }],
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: NINGauge) => {
        if (gauge.level > 62) {
            gauge.ninkiGauge += 5;
        }
    },
};

export const GustSlash: NinGcdAbility = {
    type: 'gcd',
    name: "Gust Slash",
    id: 2242,
    attackType: "Weaponskill",
    potency: 360,
    syncedPotency: [{
        minLevel: 94,
        potency: 360,
    }, {
        minLevel: 84,
        potency: 320,
    }, {
        minLevel: 74,
        potency: 280,
    }, {
        minLevel: 1,
        potency: 260,
    }],
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: NINGauge) => {
        if (gauge.level > 62) {
            gauge.ninkiGauge += 5;
        }
    },
};

export const AeolianEdge: NinGcdAbility = {
    type: 'gcd',
    name: "Aeolian Edge",
    id: 2255,
    attackType: "Weaponskill",
    potency: 440,
    // TODO: Update once available in Dawntrail 
    syncedPotency: [{
        minLevel: 74,
        potency: 440,
    }, {
        minLevel: 1,
        potency: 400,
    }],
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: NINGauge) => {
        if (gauge.level > 62) {
            gauge.ninkiGauge += 5;
        } else if (gauge.level > 78) {
            gauge.ninkiGauge += 10;
        } else if (gauge.level > 84) {
            gauge.ninkiGauge += 15;
        }
        gauge.kazematoi--;
    },
};

export const ArmorCrush: NinGcdAbility = {
    type: 'gcd',
    name: "Armor Crush",
    id: 3563,
    attackType: "Weaponskill",
    potency: 460,
    syncedPotency: [{
        minLevel: 94,
        potency: 460,
    }, {
        minLevel: 74,
        potency: 420,
    }, {
        minLevel: 1,
        potency: 380,
    }],
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: NINGauge) => {
        if (gauge.level > 62) {
            gauge.ninkiGauge += 5;
        } else if (gauge.level > 78) {
            gauge.ninkiGauge += 10;
        } else if (gauge.level > 84) {
            gauge.ninkiGauge += 15;
        }
        gauge.kazematoi += 2;
    },
};

export const Raiju: NinGcdAbility = {
    type: 'gcd',
    name: "Fleeting Raiju",
    id: 25778,
    attackType: "Weaponskill",
    potency: 600,
    syncedPotency: [{
        minLevel: 94,
        potency: 600,
    }, {
        minLevel: 1,
        potency: 560,
    }],
    gcd: 2.5,
    cast: 0,
    updateGauge: gauge => gauge.ninkiGauge += 5,
};

export const Phantom: NinGcdAbility = {
    type: 'gcd',
    name: "Phantom Kamaitachi",
    id: 25774,
    attackType: "Weaponskill",
    potency: 600, // TODO: Mark as Pet Damage Potency
    gcd: 2.5,
    cast: 0,
    updateGauge: gauge => gauge.ninkiGauge += 5,
};

export const Ten: MudraStep & OriginCdAbility = {
    type: 'gcd',
    name: "Ten",
    id: 2259,
    noChargeId: 18805,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 20,
        charges: 2,
    },
    gcd: 0.5,
    fixedGcd: true,
    cast: 0,
};

export const Chi: MudraStep & SharedCdAbility = {
    type: 'gcd',
    name: "Chi",
    id: 2261,
    noChargeId: 18806,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 20,
        charges: 2,
        sharesCooldownWith: Ten,
    },
    gcd: 0.5,
    fixedGcd: true,
    cast: 0,
};

export const Jin: MudraStep & SharedCdAbility = {
    type: 'gcd',
    name: "Jin",
    id: 2263,
    noChargeId: 18807,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 20,
        charges: 2,
        sharesCooldownWith: Ten,
    },
    gcd: 0.5,
    fixedGcd: true,
    cast: 0,
};

export const Fuma: NinjutsuAbility = {
    type: 'gcd',
    name: "Fuma Shuriken",
    id: 2265,
    attackType: "Ability",
    potency: 480,
    syncedPotency: [{
        minLevel: 94,
        potency: 480,
    }, {
        minLevel: 1,
        potency: 450,
    }],
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    steps: [Ten],
};

export const Raiton: NinjutsuAbility = {
    type: 'gcd',
    name: "Raiton",
    id: 2267,
    attackType: "Ability",
    potency: 700,
    syncedPotency: [{
        minLevel: 94,
        potency: 700,
    }, {
        minLevel: 1,
        potency: 650,
    }],
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    activatesBuffs: [RaijuReady],
    steps: [Ten, Chi],
};

export const Suiton: NinjutsuAbility = {
    type: 'gcd',
    name: "Suiton",
    id: 2271,
    attackType: "Ability",
    potency: 540,
    syncedPotency: [{
        minLevel: 94,
        potency: 540,
    }, {
        minLevel: 1,
        potency: 500,
    }],
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    activatesBuffs: [ShadowWalker],
    steps: [Ten, Chi, Jin],
};

export const Hyosho: NinjutsuAbility = {
    type: 'gcd',
    name: "Hyosho Ranryu",
    id: 16492,
    attackType: "Ability",
    potency: 1300,
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    steps: [Ten, Jin],
};

/**
 * Off GCD Actions
 */
export const KunaisBane: NinOgcdAbility = {
    type: 'ogcd',
    name: "Kunai's Bane",
    // TODO: Update once available in Dawntrail
    id: 2258,
    attackType: "Ability",
    potency: 600,
    syncedPotency: [{
        minLevel: 92,
        potency: 600,
    }, {
        minLevel: 1,
        potency: 400,
    }],
    cooldown: {
        time: 60
    },
    activatesBuffs: [KunaisBaneBuff],
};

export const Kassatsu: NinOgcdAbility = {
    type: 'ogcd',
    name: "Kassatsu",
    id: 2264,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 60
    },
    activatesBuffs: [KassatsuBuff],
};

export const TenChiJin: NinOgcdAbility = {
    type: 'ogcd',
    name: "Ten Chi Jin",
    id: 7403,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 120
    },
    activatesBuffs: [TenChiJinReady, TenriJindoReady],
};

export const Meisui: NinOgcdAbility = {
    type: 'ogcd',
    name: "Meisui",
    id: 16489,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 120
    },
    activatesBuffs: [MeisuiBuff],
    updateGauge: gauge => gauge.ninkiGauge += 50,
}

export const Bunshin: NinkiAbility = {
    type: 'ogcd',
    name: "Bunshin",
    id: 16493,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 90
    },
    activatesBuffs: [BunshinBuff, PhantomReady],
    updateGauge: gauge => gauge.ninkiGauge -= 50,
    ninkiCost: 50,
};

export const DokumoriAbility: NinOgcdAbility = {
    type: 'ogcd',
    name: "Dokumori",
    // TODO: Update once available in Dawntrail
    id: 2248,
    attackType: "Ability",
    potency: 300,
    cooldown: {
        time: 120
    },
    activatesBuffs: [Dokumori, Higi],
};

export const DreamWithin: NinOgcdAbility = {
    type: 'ogcd',
    name: "Dream Within a Dream",
    id: 3566,
    attackType: "Ability",
    potency: 150 * 3, // Multihit
}

export const Bhavacakra: NinkiAbility = {
    type: 'ogcd',
    name: "Bhavacakra",
    id: 7402,
    attackType: "Ability",
    potency: 380,
    syncedPotency: [{
        minLevel: 94,
        potency: 380,
    }, {
        minLevel: 1,
        potency: 350,
    }],
    updateGauge: gauge => gauge.ninkiGauge -= 50,
    ninkiCost: 50,
};

export const ZeshoMeppo: NinkiAbility = {
    type: 'ogcd',
    name: "Zesho Meppo",
    // TODO: Update once available in Dawntrail
    id: 7402,
    attackType: "Ability",
    potency: 550,
    updateGauge: gauge => gauge.ninkiGauge -= 50,
    ninkiCost: 50,
};

export const TenriJindo: NinOgcdAbility = {
    type: 'ogcd',
    name: "Tenri Jindo",
    // TODO: Update once available in Dawntrail
    id: 7403,
    attackType: "Ability",
    potency: 1000,
};