import { Ability, Buff, BuffController, PersonalBuff } from "@xivgear/core/sims/sim_types";
import * as Actions from "./vpr_actions";

export const HonedReavers: PersonalBuff = {
    name: "Honed Reavers",
    saveKey: "Honed Reavers",
    duration: 60,
    selfOnly: true,
    effects: {
        // Increases potency of Reaving Fang by 100
    },
    statusId: 3772,
    appliesTo: ability => ability.id === Actions.ReavingFangs.id,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return {
            ...ability,
            potency: ability.potency + 100
        };
    }
};

export const HonedSteel: PersonalBuff = {
    name: "Honed Steel",
    saveKey: "Honed Steel",
    duration: 60,
    selfOnly: true,
    effects: {
        // Increases potency of Reaving Fang by 100
    },
    statusId: 3772,
    appliesTo: ability => ability.id === Actions.SteelFangs.id,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return {
            ...ability,
            potency: ability.potency + 100
        };
    }
};

export const HuntersInstinct: PersonalBuff = {
    name: "Hunter's Instinct",
    saveKey: "Hunter's Instinct",
    duration: 40,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.1
    },
    statusId: 3668
};

export const Swiftscaled: PersonalBuff = {
    name: "Swiftscaled",
    saveKey: "SwiftScaled",
    duration: 40,
    selfOnly: true,
    effects: {
        haste: 15
    },
    statusId: 3669
};

const ComboFinisherBaseBuff: Buff = {
    name: null,
    saveKey: null,
    duration: 60,
    selfOnly: true,
    effects: {
        // Only applies to Hindsting strike, buffing potency by 100p
    },
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return {
            ...ability,
            potency: ability.potency + 100
        };
    }
};

export const FlankstungVenom: PersonalBuff = {
    ...ComboFinisherBaseBuff,
    name: "Flankstung Venom",
    saveKey: "Flankstung Venom",
    appliesTo: ability => ability.id === Actions.FlankstingStrike.id,
    statusId: 3645
};

export const FlanksbaneVenom: PersonalBuff = {
    ...ComboFinisherBaseBuff,
    name: "Flanksbane Venom",
    saveKey: "Flanksbane Venom",
    appliesTo: ability => ability.id === Actions.FlanksbaneFang.id,
    statusId: 3646
};

export const HindstungVenom: PersonalBuff = {
    ...ComboFinisherBaseBuff,
    name: "Hindstung Venom",
    saveKey: "Hindstung Venom",
    appliesTo: ability => ability.id === Actions.HindstingStrike.id,
    statusId: 3647
};

export const HindsbaneVenom: PersonalBuff = {
    ...ComboFinisherBaseBuff,
    name: "Hindsbane Venom",
    saveKey: "Hindsbane Venom",
    appliesTo: ability => ability.id === Actions.HindsbaneFang.id,
    statusId: 3648
};

export const ReadyToReawaken: PersonalBuff = {
    name: "Ready to Reawaken",
    saveKey: "Ready to Reawaken",
    duration: 30,
    selfOnly: true,
    effects: {
        // Makes reawaken free
    },
    appliesTo: ability => ability.id === Actions.Reawaken.id,
    statusId: 3671,
    beforeSnapshot<VprGcdAbility>(buffController: BuffController, ability: VprGcdAbility): VprGcdAbility {
        buffController.removeSelf();
        return {
            ...ability,
            updateGauge: null
        };
    }
};

export const HuntersVenom: PersonalBuff = {
    name: "Hunter's Venom",
    saveKey: "Hunter's Venom",
    duration: 30,
    selfOnly: true,
    effects: {
        // Increases Twinfang Bite potency by 50
    },
    appliesTo: ability => ability.id === Actions.TwinfangBite.id,
    beforeAbility<VprOgcdAbility>(buffController: BuffController, ability: VprOgcdAbility): VprOgcdAbility {
        buffController.removeSelf();
        return {
            ...ability,
            potency: 170
        };
    }
};

export const SwiftskinsVenom: PersonalBuff = {
    name: "Swiftskin's Venom",
    saveKey: "Swiftskin's Venom",
    duration: 30,
    selfOnly: true,
    effects: {
        // Increases Twinfang Bite potency by 50
    },
    appliesTo: ability => ability.id === Actions.TwinbloodBite.id,
    beforeAbility<VprOgcdAbility>(buffController: BuffController, ability: VprOgcdAbility): VprOgcdAbility {
        buffController.removeSelf();
        return {
            ...ability,
            potency: 170
        };
    }
};

export const PoisedForTwinfang: PersonalBuff = {
    name: "Poised for Twinfang",
    saveKey: "Poised for Twinfang",
    duration: 60,
    selfOnly: true,
    effects: {
        // Increases Twinfang Bite potency by 50
    },
    appliesTo: ability => ability.id === Actions.UncoiledTwinfang.id,
    beforeAbility<VprOgcdAbility>(buffController: BuffController, ability: VprOgcdAbility): VprOgcdAbility {
        buffController.removeSelf();
        return {
            ...ability,
            potency: 170
        };
    }
};

export const PoisedForTwinblood: PersonalBuff = {
    name: "Poised for Twinblood",
    saveKey: "Poised for Twinblood",
    duration: 60,
    selfOnly: true,
    effects: {
        // Increases Twinfang Bite potency by 50
    },
    appliesTo: ability => ability.id === Actions.UncoiledTwinblood.id,
    beforeAbility<VprOgcdAbility>(buffController: BuffController, ability: VprOgcdAbility): VprOgcdAbility {
        buffController.removeSelf();
        return {
            ...ability,
            potency: 170
        };
    }
};
