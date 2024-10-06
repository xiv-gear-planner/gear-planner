import { Ability, GcdAbility, OgcdAbility, Buff, BuffController } from "@xivgear/core/sims/sim_types"
import { DrkGauge } from "./drk_gauge"
import {removeSelf} from "@xivgear/core/sims/common/utils";

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

/** DRK ability that costs shroud */
export type BloodAbility = DrkAbility & Readonly<{
    bloodCost: number;
}>

/** Represents the DRK gauge state */
export type DrkGaugeState = {
    level: number,
    blood: number,
    mp: number,
}

/** Represents the extra data for UsedAbility */
export type DrkExtraData = {
    /** The DRK gauge data */
    gauge: DrkGaugeState,
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
    appliesTo: ability => ability.attackType === "Spell" || ability.attackType === "Weaponskill" ,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1)
        return null;
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
        return null;
    },
    statusId: 3836,
};

/** Represents the Rotation data based on GCD. */
export type DrkRotationData = {
    /** The name of the rotation selected */
    name: string,
    /** The actual rotations selected */
    rotation: {
        /** The opener for the rotation */
        opener: DrkAbility[],
        /** The optional rotation loop */
        loop: DrkAbility[],
    }
};