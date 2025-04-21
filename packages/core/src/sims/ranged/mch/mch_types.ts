import {Ability, GcdAbility, OgcdAbility, Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {MchGauge} from "./mch_gauge";
import {removeSelf} from "@xivgear/core/sims/common/utils";

export type MchAbility = Ability & Readonly<{
    /** Run if an ability needs to update the Heat gauge */
    updateHeatGauge?(gauge: MchGauge): void;

    /** Run if an ability needs to update the battery gauge */
    updateBatteryGauge?(gauge: MchGauge): void;

    /** The heat Gauge cost of the ability */
    heatGaugeCost?: number;

    /** The battery Gauge cost of the ability */
    batteryGaugeCost?: number;
}>

export type MchGcdAbility = GcdAbility & MchAbility;

export type MchOgcdAbility = OgcdAbility & MchAbility;

/** MCH ability that costs heat gauge */
export type heatGaugeAbility = MchAbility & Readonly<{
    heatGaugeCost: number;
}>

/** MCH ability that costs heat gauge */
export type batteryGaugeAbility = MchAbility & Readonly<{
    batteryGaugeCost: number;
}>

/** Represents MCH's Gauge state */
export type MchGaugeState = {
    heatGauge: number,
    batteryGauge: number,
}


/** Represents the extra data for UsedAbility, primarily for consumption in the UI */
export type MchExtraData = {
    /** The battery gauge data */
    gauge: MchGaugeState,
    hypercharge: number,
};

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


export const HyperchargeBuff: Buff = {
    name: "Hypercharge",
    duration: 10,
    selfOnly: true,
    stacks: 5,
    effects: {
        // Adds potency to attacks.
    },
    appliesTo: ability => ability.type === "gcd",
    beforeAbility<X extends MchAbility>(buffController: BuffController, ability: X): X {
        return {
            ...ability,
            potency: ability.potency + 20,
        };
    },
    beforeSnapshot<X extends MchAbility>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1);
        return ability;
    },
    statusId: 688,
};

export const FullMetalFieldBuff: Buff = {
    name: "Full Metal Field",
    duration: 30,
    effects: {
        // Allows usage of Full Metal Field
    },
    selfOnly: true,
    appliesTo: ability => ability.name === "Full Metal Field",
    beforeSnapshot: removeSelf,
    statusId: 3866,
};

export const HyperchargedBuff: Buff = {
    name: "Hypercharged",
    selfOnly: true,
    effects: {
        // Allows usage of Hypercharge
    },
    appliesTo: ability => ability.name === "Hypercharge",
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3864,
};

export const ExcavatorReadyBuff: Buff = {
    name: "Excavator Ready",
    duration: 30,
    effects: {
        // Allows usage of Excavator
    },
    selfOnly: true,
    appliesTo: ability => ability.name === "Excavator",
    beforeSnapshot: removeSelf,
    statusId: 3865,
};
