import {GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {Dokumori} from "@xivgear/core/sims/buffs";
import {TenriJindoReady, KassatsuBuff, BunshinBuff, Higi, MeisuiBuff, KunaisBaneBuff, PhantomReady, TenChiJinReady, ShadowWalker} from './nin_buffs';

/**
 * Represents a Mudra Step
 */
export type MudraStep = Readonly<{
    /** The ability id */
    id: number,
    /** The ability name */
    name: string,
}>;

/**
 * Represents a Ninjutsu Ability
 */
export type NinjutsuAbility = GcdAbility & Readonly<{
    /** The mudra combination for this Ninjutsu */
    steps: MudraStep[]
    /** Whether or not this Ninjutsu should add a Raiju stack. */
    addRaiju?: boolean,
}>

/**
 * Represents an Ability that costs Ninki
 */
export type NinkiAbility = OgcdAbility & Readonly<{
    /** The Ninki cost of this ability */
    ninkiCost: number,
}>

/**
 * Whether or not this ability is a Ninki spender
 * @param action The ability to check
 * @returns
 */
export function isNinkiAbility(action: NinkiAbility | OgcdAbility): action is NinkiAbility {
    return (action as NinkiAbility).ninkiCost !== undefined;
}

/**
 * Mudras
 */
const Ten: MudraStep = {
    id: 18805,
    name: "Ten"
};

const Chi: MudraStep = {
    id: 18806,
    name: "Chi"
};

const Jin: MudraStep = {
    id: 18807,
    name: "Jin"
};

/**
 * GCD Actions
 */
export const SpinningEdge: GcdAbility = {
    type: 'gcd',
    name: "Spinning Edge",
    id: 2240,
    attackType: "Weaponskill",
    potency: 280,
    gcd: 2.5,
    cast: 0
};

export const GustSlash: GcdAbility = {
    type: 'gcd',
    name: "Gust Slash",
    id: 2242,
    attackType: "Weaponskill",
    potency: 360,
    gcd: 2.5,
    cast: 0
};

export const AeolianEdge: GcdAbility = {
    type: 'gcd',
    name: "Aeolian Edge",
    id: 2255,
    attackType: "Weaponskill",
    potency: 440 + 60, // Includes Kazematoi
    gcd: 2.5,
    cast: 0
};

export const ArmorCrush: GcdAbility = {
    type: 'gcd',
    name: "Armor Crush",
    id: 3563,
    attackType: "Weaponskill",
    potency: 460,
    gcd: 2.5,
    cast: 0
};

export const Phantom: GcdAbility = {
    type: 'gcd',
    name: "Phantom Kamaitachi",
    id: 25774,
    attackType: "Weaponskill",
    potency: 600, // TODO: Mark as Pet Damage Potency
    gcd: 2.5,
    cast: 0
};

export const Raiju: GcdAbility = {
    type: 'gcd',
    name: "Fleeting Raiju",
    id: 25778,
    attackType: "Weaponskill",
    potency: 600,
    gcd: 2.5,
    cast: 0
};

export const MudraStart: GcdAbility = {
    type: 'gcd',
    name: "Mudra Start",
    id: 2259,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 20,
        charges: 2
    },
    gcd: 0.5,
    fixedGcd: true,
    cast: 0
};

export const MudraFollowup: GcdAbility = {
    type: 'gcd',
    name: "Follow-up Mudra",
    id: 18806,
    attackType: "Ability",
    potency: null,
    gcd: 0.5,
    fixedGcd: true,
    cast: 0
};


export const Fuma: NinjutsuAbility = {
    type: 'gcd',
    name: "Fuma Shuriken",
    id: 2265,
    attackType: "Ability",
    potency: 480,
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    steps: [Ten]
};

export const Raiton: NinjutsuAbility = {
    type: 'gcd',
    name: "Raiton",
    id: 2267,
    attackType: "Ability",
    potency: 700,
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    steps: [Ten, Chi],
    addRaiju: true,
};

export const Suiton: NinjutsuAbility = {
    type: 'gcd',
    name: "Suiton",
    id: 2271,
    attackType: "Ability",
    potency: 540,
    gcd: 1.5,
    fixedGcd: true,
    cast: 0,
    activatesBuffs: [ShadowWalker],
    steps: [Ten, Chi, Jin]
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
    steps: [Ten, Jin]
};

/**
 * Off GCD Actions
 */
export const KunaisBane: OgcdAbility = {
    type: 'ogcd',
    name: "Kunai's Bane",
    // TODO: Update once available in Dawntrail
    id: 2258,
    attackType: "Ability",
    potency: 600,
    cooldown: {
        time: 60
    },
    activatesBuffs: [KunaisBaneBuff],
};

export const Kassatsu: OgcdAbility = {
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

export const TenChiJin: OgcdAbility = {
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

export const Meisui: OgcdAbility = {
    type: 'ogcd',
    name: "Meisui",
    id: 16489,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 120
    },
    activatesBuffs: [MeisuiBuff],
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
    ninkiCost: 50,
};

export const DokumoriAbility: OgcdAbility = {
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

export const DreamWithin: OgcdAbility = {
    type: 'ogcd',
    name: "Dream Within a Dream",
    id: 3566,
    attackType: "Ability",
    potency: 150 * 3 // Multihit
}

export const Bhavacakra: NinkiAbility = {
    type: 'ogcd',
    name: "Bhavacakra",
    id: 7402,
    attackType: "Ability",
    potency: 380,
    ninkiCost: 50
};

export const ZeshoMeppo: NinkiAbility = {
    type: 'ogcd',
    name: "Zesho Meppo",
    // TODO: Update once available in Dawntrail
    id: 7402,
    attackType: "Ability",
    potency: 550,
    ninkiCost: 50
};

export const TenriJindo: OgcdAbility = {
    type: 'ogcd',
    name: "Tenri Jindo",
    // TODO: Update once available in Dawntrail
    id: 7403,
    attackType: "Ability",
    potency: 1000
};