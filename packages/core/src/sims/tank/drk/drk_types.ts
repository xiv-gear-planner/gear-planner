import { Ability, GcdAbility, OgcdAbility, Buff, BuffController } from "@xivgear/core/sims/sim_types";
import { DrkGauge } from "./drk_gauge";
import { removeSelf } from "@xivgear/core/sims/common/utils";

/** A DRK-specific ability. */
export type DrkAbility = Ability & Readonly<{
    /** Run if an ability needs to update the Blood gauge */
    updateBloodGauge?(gauge: DrkGauge): void;
    
    /** The Blood cost of the ability */
    bloodCost?: number;

    /** Run if an ability needs to update MP */
    updateMP?(gauge: DrkGauge): void;
    
    /** The MP cost of the ability */
    mp?: number;
}>

export type DrkGcdAbility = GcdAbility & DrkAbility;

export type DrkOgcdAbility = OgcdAbility & DrkAbility;

/** DRK ability that costs blood */
export type BloodAbility = DrkAbility & Readonly<{
    bloodCost: number;
}>

/** Represents the DRK gauge state */
export type DrkGaugeState = {
    level: number,
    blood: number,
    mp: number,
    darkArts: boolean,
}

/** Represents the extra data for UsedAbility, primarily for consumption in the UI */
export type DrkExtraData = {
    /** The DRK gauge data */
    gauge: DrkGaugeState,
    darksideDuration: number,
};

export const ScornBuff: Buff = {
    name: "Scorn",
    duration: 30,
    selfOnly: true,
    effects: {
       // Allows usage of Disesteem
    },
    appliesTo: ability => ability.name === "Disesteem",
    beforeSnapshot: removeSelf,
    statusId: 3837,
};

export const SaltedEarthBuff: Buff = {
    name: "Salted Earth",
    duration: 15,
    selfOnly: true,
    effects: {
       // Allows usage of Salt and Darkness
    },
    statusId: 749,
};

export const BloodWeaponBuff: Buff = {
    name: "Blood Weapon",
    duration: 15,
    selfOnly: true,
    effects: {
       // Adds 10 blood per usage
       // Adds 600 MP per usage
    },
    stacks: 3,
    appliesTo: ability => ability.type === "gcd",
    beforeAbility<X extends DrkAbility>(buffController: BuffController, ability: X): X {
        const oldUpdateBlood = ability.updateBloodGauge
        const oldUpdateMP = ability.updateMP
        return {
            ...ability,
            updateBloodGauge: gauge => {
                gauge.bloodGauge += 10
                if (oldUpdateBlood) {
                    oldUpdateBlood(gauge)
                }
            },
            updateMP: gauge => {
                gauge.magicPoints += 600
                if (oldUpdateMP) {
                    oldUpdateMP(gauge)
                }
            },
        };
    },
    beforeSnapshot<X extends DrkAbility>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1)
        return ability
    },
    statusId: 742,
};

export const DeliriumBuff: Buff = {
    name: "Delirium",
    duration: 15,
    selfOnly: true,
    effects: {
       // Allows usage of Delirium combo
    },
    stacks: 3,
    appliesTo: ability => ability.name === "Scarlet Delirium" || ability.name === "Comeuppance" || ability.name === "Torcleaver",
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1)
        return ability;
    },
    statusId: 3836,
};
