import {Ability, GcdAbility, OgcdAbility, Buff, BuffController} from "@xivgear/core/sims/sim_types";
import {GnbGauge} from "./gnb_gauge";
import {PersonalBuff} from "@xivgear/core/sims/sim_types";

/** A GNB-specific ability. */
export type GnbAbility = Ability & Readonly<{
    /** Run if an ability needs to update cartridges */
    updateCartridges?(gauge: GnbGauge): void;

    /** The Cartridge Gauge cost of the ability */
    cartridgeCost?: number;
}>

export type GnbGcdAbility = GcdAbility & GnbAbility;

export type GnbOgcdAbility = OgcdAbility & GnbAbility;

/** GNB ability that costs cartridges */
export type CartridgeAbility = GnbAbility & Readonly<{
    cartridgeCost: number;
}>

/** Represents the GNB gauge state */
export type GnbGaugeState = {
    maxCartridges: number,
    cartridges: number,
}

/** Represents the extra data for UsedAbility, primarily for consumption in the UI */
export type GnbExtraData = {
    /** The GNB gauge data */
    gauge: GnbGaugeState,
    noMercyDuration: number,
};

export const NoMercyBuff: PersonalBuff = {
    name: "No Mercy",
    saveKey: "No Mercy",
    duration: 20,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.2,
    },
    statusId: 1831,
};

export const ReadyToBreakBuff: Buff = {
    name: "Ready To Break",
    duration: 30,
    selfOnly: true,
    effects: {
        // Also allows usage of Sonic Break
    },
    appliesTo: ability => ability.name === "Sonic Break",
    beforeSnapshot<X extends GnbAbility>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return ability;
    },
    statusId: 3886,
};

export const ReadyToReignBuff: Buff = {
    name: "Ready To Reign",
    duration: 30,
    selfOnly: true,
    effects: {
        // Also allows usage of Reign of Beasts
    },
    appliesTo: ability => ability.name === "Reign of Beasts",
    beforeSnapshot<X extends GnbAbility>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return ability;
    },
    statusId: 3840,
};

export const ReadyToRipBuff: Buff = {
    name: "Ready To Rip",
    duration: 10,
    selfOnly: true,
    effects: {
        // Also allows usage of Jugular Rip
    },
    appliesTo: ability => ability.name === "Jugular Rip",
    beforeSnapshot<X extends GnbAbility>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return ability;
    },
    statusId: 1842,
};

export const ReadyToTearBuff: Buff = {
    name: "Ready To Tear",
    duration: 10,
    selfOnly: true,
    effects: {
        // Also allows usage of Abdomen Tear
    },
    appliesTo: ability => ability.name === "Abdomen Tear",
    beforeSnapshot<X extends GnbAbility>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return ability;
    },
    statusId: 1843,
};

export const ReadyToGougeBuff: Buff = {
    name: "Ready To Gouge",
    duration: 10,
    selfOnly: true,
    effects: {
        // Also allows usage of Eye Gouge
    },
    appliesTo: ability => ability.name === "Eye Gouge",
    beforeSnapshot<X extends GnbAbility>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return ability;
    },
    statusId: 1844,
};

export const ReadyToBlastBuff: Buff = {
    name: "Ready To Blast",
    duration: 10,
    selfOnly: true,
    effects: {
        // Also allows usage of Hypervelocity
    },
    appliesTo: ability => ability.name === "Hypervelocity",
    beforeSnapshot<X extends GnbAbility>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return ability;
    },
    statusId: 2686,
};
