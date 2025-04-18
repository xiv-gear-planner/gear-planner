import {Ability, GcdAbility, OgcdAbility, Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {MchheatGauge} from "./mch_heatgauge";
import {MchbatteryGauge} from "./mch_batterygauge";
import {removeSelf} from "@xivgear/core/sims/common/utils";
import {PersonalBuff} from "@xivgear/core/sims/sim_types";

export type MchAbility = Ability & Readonly<{
    /** Run if an ability needs to update the Heat gauge */
    updateHeatGauge?(gauge: heatGauge): void;

    /** The heat Gauge cost of the ability */
    heatGaugeCost?: number;
}>

export type MchAbility = Ability & Readonly<{
    /** Run if an ability needs to update the battery gauge */
    updateBatteryGauge?(gauge: batteryGauge): void;

    /** The battery Gauge cost of the ability */
    batteryGaugeCost?: number;
}>

export type MchGcdAbility = GcdAbility & MchAbility;

export type MchOgcdAbility = OgcdAbility & MchAbility;

/** MCH ability that costs heat gauge */
export type heatGaugeAbility = mchAbility & Readonly<{
    heatGaugeCost: number;
}>

/** MCH ability that costs heat gauge */
export type batteryGaugeAbility = mchAbility & Readonly<{
    batteryGaugeCost: number;
}>

/** Represents the heat gauge state */
export type mchheatGaugeState = {
    heatGauge: number,
}

/** Represents the battery gauge state */
export type mchbatteryGaugeState = {
    batteryGauge: number,
}


/** Represents the extra data for UsedAbility, primarily for consumption in the UI */
export type MchExtraData = {
    /** The battery gauge data */
    gauge: MchbatteryGaugeState,
    automatonqueen: number,
};

export type MchExtraData = {
    /** The heat gauge data */
    gauge: MchHeatGaugeState,
    hypercharge: number,
};

/** Buff usage */

export const ReassembleBuff: Buff = {
    name: "Reassemble",
    duration: 5,
    selfOnly: true,
    effects: {
        forceCrit: true,
        forceDhit: true,
    },
    appliesTo: ability => ability.type === "gcd",
    beforeSnapshot: removeSelf,
    statusId: 851,
};

//export const AutomatonQueenBuff: PersonalBuff = {
//    name: "Queen active",
//    duration: n,
//    selfOnly: true,
//};

export const HyperchargeBuff: Buff = {
    name: "Hypercharged",
    duration: 10,
    selfOnly: true,
    stacks: 5,
    appliesTo: ability => ability.type === "gcd",
    beforeAbility<X extends MchAbility>(buffController: BuffController, ability: X): X {
        return {
        ...ability,
        potency: ability.potency + 20
        }
     },
    beforeSnapshot<X extends mchAbility>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1);
        return ability;
    },
    statusId: 3864,
};

export const FullMetalFieldReadyBuff: Buff = {
    name: "Full Metal Field ready",
    duration: 30,
    selfOnly: true,
    appliesTo: ability => ability.name === "Full Metal Field",
    beforeSnapshot: removeSelf,
};

export const FreeHypercharge: Buff = {
    name: "Hypercharge ready",
    selfOnly: true,
    appliesTo: ability => ability.name === "Hypercharge"
    beforeSnapshot: removeSelf,
    duration: 30,
};

export const ExcavatorReadyBuff: Buff = {
    name: "Excavator ready",
    duration: 30,
    selfOnly: true,
    appliesTo: ability => ability.name === "Excavator",
    beforeSnapshot: removeSelf,
};