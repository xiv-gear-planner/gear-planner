import {Buff, Ability, BuffController} from "@xivgear/core/sims/sim_types";
import {removeSelf} from "@xivgear/core/sims/common/utils";
import {Phantom} from "./nin_actions";

/**
 * Ninja-specific Buffs
 */
export const KunaisBaneBuff: Buff = {
    name: "Kunai's Bane",
    selfOnly: true,
    effects: {
        dmgIncrease: 0.1,
    },
    duration: 16.25,
    statusId: 3906,
};

const NINJUTSU_ACTIONS_1STEP: string[] = [
    "Fuma Shuriken"
];
const NINJUTSU_ACTIONS_2STEP: string[] = [
    "Katon", "Raiton", "Hyoton",
    "Hyosho Ranryu", "Goka Mekkyaku"
];
const NINJUTSU_ACTIONS_3STEP: string[] = [
    "Huton", "Doton", "Suiton"
];
const NINJUTSU_ACTIONS: string[] = [
    ...NINJUTSU_ACTIONS_1STEP,
    ...NINJUTSU_ACTIONS_2STEP,
    ...NINJUTSU_ACTIONS_3STEP
];
export const KassatsuBuff: Buff = {
    name: "Kassatsu",
    selfOnly: true,
    descriptionExtras: ["Able to execute a ninjutsu without consuming charges while increasing damage"],
    effects: {
        dmgIncrease: 0.3,
    },
    appliesTo: ability => NINJUTSU_ACTIONS.includes(ability.name),
    beforeSnapshot: removeSelf,
    // The duration of Kassatsu is increased here to ensure it will be active even if the ogcd is mistimed
    duration: 30,
    statusId: 497,
};

export const TenChiJinReady: Buff = {
    name: "Ten Chi Jin",
    selfOnly: true,
    descriptionExtras: ["Able to execute 3 ninjutsu actions in succession"],
    effects: {
        // Only applies to ninjutsu actions
    },
    appliesTo: ability => NINJUTSU_ACTIONS.includes(ability.name),
    beforeAbility<X extends Ability>(_buffController: BuffController, ability: X): X {
        if (!NINJUTSU_ACTIONS_3STEP.includes(ability.name)) {
            return {
                ...ability,
                gcd: 1.0,
            };
        }
        return null;
    },
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        if (NINJUTSU_ACTIONS_3STEP.includes(ability.name)) {
            buffController.removeSelf();
        }
        return null;
    },
    duration: 6,
    statusId: 1186,
};

export const TenriJindoReady: Buff = {
    name: "Tenri Jindo Ready",
    selfOnly: true,
    descriptionExtras: ["Able to execute Tenri Jindo"],
    effects: {
        // Only applies to Tenri Jindo
    },
    appliesTo: ability => ability.name === "Tenri Jindo",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3851,
};

export const ShadowWalker: Buff = {
    name: "Shadow Walker",
    selfOnly: true,
    descriptionExtras: ["Able to execute actions normally only available while hidden"],
    effects: {
        // Only applies to Kunai's Bane and Mesui
    },
    appliesTo: ability => ability.name === "Meisui" || ability.name === "Kunai's Bane",
    beforeSnapshot: removeSelf,
    duration: 20,
    statusId: 3848,
};

export const MeisuiBuff: Buff = {
    name: "Meisui",
    selfOnly: true,
    descriptionExtras: ["Increase potency of single-target ninki spenders"],
    effects: {
        // Only applies to Bhavacakra and Zesho Meppo
        // Increases potency of either by 150
    },
    appliesTo: ability => ability.name === "Zesho Meppo" || ability.name === "Bhavacakra",
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return {
            ...ability,
            potency: ability.potency + 150,
        };
    },
    duration: 30,
    statusId: 2689,
};

export const BunshinBuff: Buff = {
    name: "Bunshin",
    selfOnly: true,
    descriptionExtras: ["Deals additional damage when executing Weaponskills"],
    effects: {
        // Only applies to Weaponskills
        // 160 pet potency per stack consumption
    },
    appliesTo: ability => ability.attackType === "Weaponskill" && ability.id !== Phantom.id,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1);
        return {
            ...ability,
            // TODO: the potency addition here should be pet potency
            potency: ability.potency + 160,
        };
    },
    stacks: 5,
    duration: 30,
    statusId: 1954,
};

export const RaijuReady: Buff = {
    name: "Raiju Ready",
    selfOnly: true,
    descriptionExtras: ["Able to execute Fleeting/Forked Raiju"],
    effects: {
        // Only applies to Raiju skills
    },
    appliesTo: ability => ability.name.endsWith(' Raiju') || ability.name === 'Raiton',
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): void {
        if (ability.name.endsWith(' Raiju')) {
            buffController.subtractStacksSelf(1);
        }
        else if (ability.name === 'Raiton') {
            buffController.addStacksSelf(1);
        }
    },
    stacks: 1,
    duration: 30,
    statusId: 2690,
};

export const PhantomReady: Buff = {
    name: "Phantom Kamaitachi Ready",
    selfOnly: true,
    descriptionExtras: ["Able to execute Phantom Kamaitachi"],
    effects: {
        // Only applies to Phantom Kamaitachi
    },
    appliesTo: ability => ability.name === "Phantom Kamaitachi",
    beforeSnapshot: removeSelf,
    duration: 45,
    statusId: 2723,
};

export const Higi: Buff = {
    name: "Higi",
    selfOnly: true,
    descriptionExtras: ["Able to execute Zesho Meppo or Deathfrog Medium"],
    effects: {
        // Only applies to Zesho Meppo and Deathfrog Medium
    },
    appliesTo: ability => ability.name === "Zesho Meppo" || ability.name === "Deathfrog Medium",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3850,
};
