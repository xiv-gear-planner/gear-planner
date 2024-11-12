import {OriginCdAbility, SharedCdAbility} from "@xivgear/core/sims/sim_types";
import {Dokumori} from "@xivgear/core/sims/buffs";
import {TenriJindoReady, KassatsuBuff, BunshinBuff, Higi, MeisuiBuff, KunaisBaneBuff, RaijuReady, PhantomReady, TenChiJinReady, ShadowWalker} from './nin_buffs';
import {NinGcdAbility, NinOgcdAbility, MudraStep, NinjutsuAbility, NinkiAbility} from "./nin_types";
import NINGauge from "./nin_gauge";

/**
 * GCD Actions
 */
export const SpinningEdge: NinGcdAbility = {
    type: 'gcd',
    name: "Spinning Edge",
    id: 2240,
    attackType: "Weaponskill",
    potency: 300,
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
    potency: 400,
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
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: NINGauge) => {
        if (gauge.level > 84) {
            gauge.ninkiGauge += 15;
        }
        else if (gauge.level > 78) {
            gauge.ninkiGauge += 10;
        }
        else if (gauge.level > 62) {
            gauge.ninkiGauge += 5;
        }
        gauge.kazematoi--;
    },
};

export const ArmorCrush: NinGcdAbility = {
    type: 'gcd',
    name: "Armor Crush",
    id: 3563,
    attackType: "Weaponskill",
    potency: 480,
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: NINGauge) => {
        if (gauge.level > 84) {
            gauge.ninkiGauge += 15;
        }
        else if (gauge.level > 78) {
            gauge.ninkiGauge += 10;
        }
        else if (gauge.level > 62) {
            gauge.ninkiGauge += 5;
        }
        gauge.kazematoi += 2;
    },
};

export const Raiju: NinGcdAbility = {
    type: 'gcd',
    name: "Fleeting Raiju",
    id: 25778,
    attackType: "Weaponskill",
    potency: 700,
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
    updateGauge: gauge => gauge.ninkiGauge += 10,
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
    potency: 500,
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
    potency: 740,
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
    potency: 580,
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
    id: 36958,
    attackType: "Ability",
    potency: 600,
    cooldown: {
        time: 60,
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
        time: 60,
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
        time: 120,
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
        time: 120,
    },
    activatesBuffs: [MeisuiBuff],
    updateGauge: gauge => gauge.ninkiGauge += 50,
};

export const Bunshin: NinkiAbility = {
    type: 'ogcd',
    name: "Bunshin",
    id: 16493,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 90,
    },
    activatesBuffs: [BunshinBuff, PhantomReady],
    updateGauge: gauge => gauge.ninkiGauge -= 50,
    ninkiCost: 50,
};

export const DokumoriAbility: NinOgcdAbility = {
    type: 'ogcd',
    name: "Dokumori",
    id: 36957,
    attackType: "Ability",
    potency: 300,
    cooldown: {
        time: 120,
    },
    activatesBuffs: [Dokumori, Higi],
    updateGauge: gauge => gauge.ninkiGauge += 40,
};

export const DreamWithin: NinOgcdAbility = {
    type: 'ogcd',
    name: "Dream Within a Dream",
    id: 3566,
    attackType: "Ability",
    potency: 180 * 3, // Multihit
};

export const Bhavacakra: NinkiAbility = {
    type: 'ogcd',
    name: "Bhavacakra",
    id: 7402,
    attackType: "Ability",
    potency: 380,
    updateGauge: gauge => gauge.ninkiGauge -= 50,
    ninkiCost: 50,
};

export const ZeshoMeppo: NinkiAbility = {
    type: 'ogcd',
    name: "Zesho Meppo",
    id: 36960,
    attackType: "Ability",
    potency: 700,
    updateGauge: gauge => gauge.ninkiGauge -= 50,
    ninkiCost: 50,
};

export const TenriJindo: NinOgcdAbility = {
    type: 'ogcd',
    name: "Tenri Jindo",
    id: 36961,
    attackType: "Ability",
    potency: 1100,
};
