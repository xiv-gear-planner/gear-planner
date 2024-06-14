import {GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {Dokumori} from "@xivgear/core/sims/buffs";
import {TenriJindoReady, KassatsuBuff, BunshinBuff, Higi, MeisuiBuff, KunaisBaneBuff, PhantomReady, TenChiJinReady} from './nin_buffs';

/**
 * GCD Actions
 */
export const SpinningEdge: GcdAbility = {
    type: 'gcd',
    name: "Spinning Edge",
    id: 2240,
    potency: 280,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};

export const GustSlash: GcdAbility = {
    type: 'gcd',
    name: "Gust Slash",
    id: 2242,
    potency: 360,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};

export const AeolianEdge: GcdAbility = {
    type: 'gcd',
    name: "Aeolian Edge",
    id: 2255,
    potency: 500, // Note: Includes 60 pot bonus from Kazematoi
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};

export const ArmorCrush: GcdAbility = {
    type: 'gcd',
    name: "Armor Crush",
    id: 3563,
    potency: 460,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};

export const Phantom: GcdAbility = {
    type: 'gcd',
    name: "Phantom Kamaitachi",
    id: 25774,
    potency: 600, // TODO: Mark as Pet Damage Potency
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};

export const Raiju: GcdAbility = {
    type: 'gcd',
    name: "Fleeting Raiju",
    id: 25778,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};

export const MudraStart: GcdAbility = {
    type: 'gcd',
    name: "First Mudra",
    id: 2259,
    potency: null,
    cooldown: {
        time: 20,
        charges: 2
    },
    attackType: "Ability",
    gcd: 0.5,
    fixedGcd: true,
    cast: 0
};

export const MudraFollowup: GcdAbility = {
    type: 'gcd',
    name: "Follow-up Mudra",
    id: 2261,
    potency: null,
    attackType: "Ability",
    gcd: 0.5,
    fixedGcd: true,
    cast: 0
};

export const Fuma: GcdAbility = {
    type: 'gcd',
    name: "Fuma Shuriken",
    id: 2265,
    potency: 480,
    attackType: "Ability",
    gcd: 1.5,
    fixedGcd: true,
    cast: 0
};

export const Raiton: GcdAbility = {
    type: 'gcd',
    name: "Raiton",
    id: 2267,
    potency: 700,
    attackType: "Ability",
    gcd: 1.5,
    fixedGcd: true,
    cast: 0
};

export const Suiton: GcdAbility = {
    type: 'gcd',
    name: "Suiton",
    id: 2271,
    potency: 540,
    attackType: "Ability",
    gcd: 1.5,
    fixedGcd: true,
    cast: 0
};

export const Hyosho: GcdAbility = {
    type: 'gcd',
    name: "Hyosho Ranryu",
    id: 16492,
    potency: 1300,
    attackType: "Ability",
    gcd: 1.5,
    fixedGcd: true,
    cast: 0
};

/**
 * Off GCD Actions
 */
export const KunaisBane: OgcdAbility = {
    type: 'ogcd',
    name: "Kunai's Bane",
    // TODO: Update once available in Dawntrail
    id: 2258,
    potency: 600,
    cooldown: {
        time: 60
    },
    attackType: "Ability",
    activatesBuffs: [KunaisBaneBuff],
};

export const Kassatsu: OgcdAbility = {
    type: 'ogcd',
    name: "Kassatsu",
    id: 2264,
    potency: null,
    cooldown: {
        time: 60
    },
    attackType: "Ability",
    activatesBuffs: [KassatsuBuff],
};

export const TenChiJin: OgcdAbility = {
    type: 'ogcd',
    name: "Ten Chi Jin",
    id: 7403,
    potency: null,
    cooldown: {
        time: 120
    },
    attackType: "Ability",
    activatesBuffs: [TenChiJinReady, TenriJindoReady],
};

export const Meisui: OgcdAbility = {
    type: 'ogcd',
    name: "Meisui",
    id: 16489,
    potency: null,
    cooldown: {
        time: 120
    },
    attackType: "Ability",
    activatesBuffs: [MeisuiBuff],
}

export const Bunshin: OgcdAbility = {
    type: 'ogcd',
    name: "Bunshin",
    id: 16493,
    potency: null,
    cooldown: {
        time: 90
    },
    attackType: "Ability",
    activatesBuffs: [BunshinBuff, PhantomReady],
};

export const DokumoriAbility: OgcdAbility = {
    type: 'ogcd',
    name: "Dokumori",
    // TODO: Update once available in Dawntrail
    id: 2248,
    potency: 300,
    cooldown: {
        time: 120
    },
    attackType: "Ability",
    activatesBuffs: [Dokumori, Higi],
};

export const Bhavacakra: OgcdAbility = {
    type: 'ogcd',
    name: "Bhavacakra",
    id: 7402,
    potency: 380,
    attackType: "Ability",
};

export const ZeshoMeppo: OgcdAbility = {
    type: 'ogcd',
    name: "Zesho Meppo",
    // TODO: Update once available in Dawntrail
    id: 7402,
    potency: 550,
    attackType: "Ability",
};

export const TenriJindo: OgcdAbility = {
    type: 'ogcd',
    name: "Tenri Jindo",
    // TODO: Update once available in Dawntrail
    id: 7403,
    potency: 1000,
    attackType: "Ability",
};