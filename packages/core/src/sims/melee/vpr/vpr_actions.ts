import { VprGcdAbility, VprOgcdAbility } from "./vpr_types";
import { FlanksbaneVenom, FlankstungVenom, HindsbaneVenom, HindstungVenom, HonedReavers, HonedSteel, HuntersInstinct, ReadyToReawaken, Swiftscaled } from "./vpr_buffs";


export const SteelFangs: VprGcdAbility = {
    type: 'gcd',
    name: "Steel Fangs",
    id: 34606,
    potency: 200,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [HonedReavers]
};

export const ReavingFangs: VprGcdAbility = {
    type: 'gcd',
    name: "Reaving Fangs",
    id: 34607,
    potency: 200,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [HonedSteel]
};

export const HuntersSting: VprGcdAbility = {
    type: 'gcd',
    name: "Hunter's Sting",
    id: 34608,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [HuntersInstinct]
};

export const SwiftskinsSting: VprGcdAbility = {
    type: 'gcd',
    name: "Swiftskin's Sting",
    id: 34609,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [Swiftscaled]
};

export const FlankstingStrike: VprGcdAbility = {
    type: 'gcd',
    name: "Flanksting Strike",
    id: 34610,
    potency: 400,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [HindstungVenom],
    updateGauge: gauge => gauge.serpentOfferings += 10
};

export const FlanksbaneFang: VprGcdAbility = {
    type: 'gcd',
    name: "Flanksbane Fang",
    id: 34611,
    potency: 400,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [HindsbaneVenom],
    updateGauge: gauge => gauge.serpentOfferings += 10
};

export const HindstingStrike: VprGcdAbility = {
    type: 'gcd',
    name: "Hindsting Strike",
    id: 34612,
    potency: 400,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [FlanksbaneVenom],
    updateGauge: gauge => gauge.serpentOfferings += 10
};

export const HindsbaneFang: VprGcdAbility = {
    type: 'gcd',
    name: "Hindsbane Fang",
    id: 34613,
    potency: 400,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [FlankstungVenom],
    updateGauge: gauge => gauge.serpentOfferings += 10
};

export const Vicewinder: VprGcdAbility = {
    type: 'gcd',
    name: "Vicewinder",
    id: 34620,
    potency: 500,
    attackType: "Weaponskill",
    gcd: 3.0,
    cast: 0,
    cooldown: {
        time: 40,
        charges: 2
    },
    updateGauge: gauge => gauge.rattlingCoils += 1
};

export const HuntersCoil: VprGcdAbility = {
    type: 'gcd',
    name: "Hunter's Coil",
    id: 34621,
    potency: 620,
    attackType: "Weaponskill",
    gcd: 3.0,
    cast: 0,
    activatesBuffs: [HuntersInstinct],
    updateGauge: gauge => gauge.serpentOfferings += 5
};

export const SwiftskinsCoil: VprGcdAbility = {
    type: 'gcd',
    name: "Swiftskin's Coil",
    id: 34622,
    potency: 620,
    attackType: "Weaponskill",
    gcd: 3.0,
    cast: 0,
    activatesBuffs: [Swiftscaled],
    updateGauge: gauge => gauge.serpentOfferings += 5
};

export const UncoiledFury: VprGcdAbility = {
    type: 'gcd',
    name: "Uncoiled Fury",
    id: 34633,
    potency: 680,
    attackType: "Weaponskill",
    gcd: 3.5,
    cast: 0,
    updateGauge: gauge => gauge.rattlingCoils -= 1
};

export const Reawaken: VprGcdAbility = {
    type: 'gcd',
    name: "Reawaken",
    id: 34626,
    potency: 750,
    attackType: "Weaponskill",
    gcd: 2.2,
    cast: 0,
    updateGauge: gauge => gauge.serpentOfferings -= 50
};

const GenerationBase: VprGcdAbility = {
    name: null,
    id: null,
    type: 'gcd',
    potency: 680,
    attackType: "Weaponskill",
    gcd: 2.0,
    cast: 0
};

export const FirstGeneration: VprGcdAbility = {
    ...GenerationBase,
    name: "First Generation",
    id: 34627
};

export const SecondGeneration: VprGcdAbility = {
    ...GenerationBase,
    name: "Second Generation",
    id: 34628
};

export const ThirdGeneration: VprGcdAbility = {
    ...GenerationBase,
    name: "Third Generation",
    id: 34629
};

export const FourthGeneration: VprGcdAbility = {
    ...GenerationBase,
    name: "Fourth Generation",
    id: 34630
};

export const Ouroboros: VprGcdAbility = {
    name: "Ouroboros",
    id: 34631,
    type: 'gcd',
    potency: 1150,
    attackType: "Weaponskill",
    gcd: 2.0,
    cast: 0
};

const LegacyBase: VprOgcdAbility = {
    name: null,
    id: null,
    type: 'ogcd',
    potency: 280,
    attackType: 'Ability'
};

export const FirstLegacy: VprOgcdAbility = {
    ...LegacyBase,
    name: "First Legacy",
    id: 34640
};

export const SecondLegacy: VprOgcdAbility = {
    ...LegacyBase,
    name: "Second Legacy",
    id: 34641
};

export const ThirdLegacy: VprOgcdAbility = {
    ...LegacyBase,
    name: "Third Legacy",
    id: 34642
};

export const FourthLegacy: VprOgcdAbility = {
    ...LegacyBase,
    name: "Fourth Legacy",
    id: 34643
};

export const SerpentsIre: VprOgcdAbility = {
    name: "Serpent's Ire",
    id: 34647,
    type: 'ogcd',
    potency: 0,
    cooldown: {
        time: 120,
        charges: 1
    },
    attackType: 'Ability',
    updateGauge: gauge => gauge.rattlingCoils += 1,
    activatesBuffs: [ReadyToReawaken]
};

export const TwinfangBite: VprOgcdAbility = {
    name: "Twinfang Bite",
    id: 34636,
    type: 'ogcd',
    potency: 120,
    attackType: 'Ability'
};

export const TwinbloodBite: VprOgcdAbility = {
    name: "Twinblood Bite",
    id: 34637,
    type: 'ogcd',
    potency: 120,
    attackType: 'Ability'
};

export const DeathRattle: VprOgcdAbility = {
    name: "Death Rattle",
    id: 34634,
    type: 'ogcd',
    potency: 280,
    attackType: 'Ability'
};

export const UncoiledTwinfang: VprOgcdAbility = {
    name: "Uncoiled Twinfang",
    id: 34644,
    type: 'ogcd',
    potency: 120,
    attackType: 'Ability'
};

export const UncoiledTwinblood: VprOgcdAbility = {
    name: "Uncoiled Twinblood",
    id: 34645,
    type: 'ogcd',
    potency: 120,
    attackType: 'Ability'
};
