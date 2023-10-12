import { Action } from './action'

export const ACTIONS: Record<string, Action> = {
    GAUSS_ROUND: {
        id: 2874,
        type: 'Ability',
        potency: 130,
        cooldown: 30,
    },
    SPREAD_SHOT: {
        id: 2870,
        type: 'Weaponskill',
        potency: 140,
        multihit: true,
    },
    HEAT_BLAST: {
        id: 7410,
        type: 'Weaponskill',
        potency: 180,
    },
    RICOCHET: {
        id: 2890,
        type: 'Ability',
        potency: 130,
        cooldown: 30,
        multihit: true,
        falloff: 0.5,
    },
    AUTO_CROSSBOW: {
        id: 16497,
        type: 'Weaponskill',
        potency: 140,
        multihit: true,
    },
    HEATED_SPLIT_SHOT: {
        id: 7411,
        type: 'Weaponskill',
        potency: 200,
        startsCombo: true,
    },
    DRILL: {
        id: 16498,
        type: 'Weaponskill',
        potency: 580,
        cooldown: 20,
    },
    HEATED_SLUG_SHOT: {
        id: 7412,
        type: 'Weaponskill',
        potency: 120,
        combo: {
            from: 7411,
            duration: 30,
            potency: 300,
        },
    },
    HEATED_CLEAN_SHOT: {
        id: 7413,
        type: 'Weaponskill',
        potency: 120,
        combo: {
            from: 7412,
            duration: 30,
            potency: 380,
        },
    },
    BIOBLASTER: {
        id: 16499,
        type: 'Weaponskill',
        potency: 50,
        cooldown: 20,
        multihit: true,
    },
    AIR_ANCHOR: {
        id: 16500,
        type: 'Weaponskill',
        potency: 580,
        cooldown: 40,
    },
    WILDFIRE: {
        id: 2878,
        type: 'Ability',
        potency: 240, // per GCD
        cooldown: 120,
    },
    SCATTERGUN: {
        id: 25876,
        type: 'Weaponskill',
        potency: 150,
        multihit: true,
    },
    CHAIN_SAW: {
        id: 25788,
        type: 'Weaponskill',
        potency: 580,
        cooldown: 60,
        multihit: true,
        falloff: 0.65,
    },
    REASSEMBLE: {
        id: 2876,
        type: 'Ability',
        cooldown: 55,
    },

    // Pet actions
    AUTOMATON_QUEEN: {
        id: 16501,
        type: 'Ability',
    },
    ARM_PUNCH: {
        id: 16504,
        type: 'Weaponskill',
        potency: 120, // @ 50 battery
    },
    ROLLER_DASH: {
        id: 17206,
        type: 'Weaponskill',
        potency: 240, // @ 50 battery
    },
    PILE_BUNKER: {
        id: 16503,
        type: 'Ability',
        potency: 340,  // @ 50 battery
    },
    CROWNED_COLLIDER: {
        id: 25787,
        type: 'Ability',
        potency: 390, // @ 50 battery
    },
}
