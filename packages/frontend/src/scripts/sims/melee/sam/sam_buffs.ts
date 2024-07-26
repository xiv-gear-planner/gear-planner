import { Buff, Ability, BuffController } from "@xivgear/core/sims/sim_types";

/**
 * Samurai-specific Buffs
 */
const FUKA_ACTIONS: string[] = [
    "Shifu", "Kasha",
];
const FUGETSU_ACTIONS: string[] = [
    "Jinpu", "Gekko",
];
const MEIKYO_ACTIONS: string[] = [
    "Yukikaze",
    ...FUKA_ACTIONS,
    ...FUGETSU_ACTIONS,
];

export const Fuka: Buff = {
    name: "Fuka",
    selfOnly: true,
    effects: {
        haste: 13,
    },
    duration: 40,
    statusId: 1299
};

export const Fugetsu: Buff = {
    name: "Fugetsu",
    selfOnly: true,
    effects: {
        dmgIncrease: 0.13,
    },
    duration: 40,
    statusId: 1298
};

export const MeikyoShisuiBuff: Buff = {
    name: "Meikyo Shisui",
    selfOnly: true,
    effects: {
        // Only applies to some combo actions
    },
    appliesTo: ability => MEIKYO_ACTIONS.includes(ability.name),
    beforeAbility<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1);
        const activatesBuffs = [];
        if (FUKA_ACTIONS.includes(ability.name)) {
            activatesBuffs.push(Fuka);
        } else if (FUGETSU_ACTIONS.includes(ability.name)) {
            activatesBuffs.push(Fugetsu);
        }
        return {
            ...ability,
            activatesBuffs: [...activatesBuffs],
        };
    },
    stacks: 3,
    duration: 40,
    statusId: 1233
};