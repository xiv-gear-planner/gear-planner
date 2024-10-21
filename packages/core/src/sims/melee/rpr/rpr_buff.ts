import {PersonalBuff} from "@xivgear/core/sims/sim_types";
import {removeSelf} from "@xivgear/core/sims/common/utils";
import * as Actions from "./rpr_actions";

export const DeathsDesign: PersonalBuff = {
    name: "Death's Design",
    saveKey: "Death's Design",
    duration: 30,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.1,
    },
    statusId: 2586,
    maxStackingDuration: 60,
};

export const IdealHost: PersonalBuff = {
    name: "Ideal Host",
    selfOnly: true,
    descriptionExtras: ["Able to execute actions normally only available while hidden",],
    effects: {
        // Only applies to Kunai's Bane and Mesui
    },
    appliesTo: ability => ability.id === Actions.Enshroud.id,
    beforeSnapshot: removeSelf,
    duration: 30,
    statusId: 3905,
};
