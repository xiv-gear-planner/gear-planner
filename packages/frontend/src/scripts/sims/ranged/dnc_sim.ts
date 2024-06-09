import {AutoAttack, GcdAbility, OgcdAbility, SimSpec} from "@xivgear/core/sims/sim_types";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseUsageCountSim, CountSimResult, ExternalCountSettings, SkillCount} from "../processors/count_sim";
import {TechnicalFinish} from "@xivgear/core/sims/buffs";

export const dncDtSheetSpec: SimSpec<DncDtSim, DncDtSimSettings> = {
    displayName: "DNC Level 100 Sim",
    loadSavedSimInstance(exported: ExternalCountSettings<DncDtSimSettings>) {
        return new DncDtSim(exported);
    },
    makeNewSimInstance(): DncDtSim {
        return new DncDtSim();
    },
    stub: "dnc-dt-sim",
    supportedJobs: ['DNC'],
    supportedLevels: [100],
    isDefaultSim: true
};

export type DncDtSimSettings = NonNullable<unknown>


export interface DncDtSimResults extends CountSimResult {
}

const cascade: GcdAbility = {
    name: 'Cascade',
    type: 'gcd',
    attackType: 'Weaponskill',
    potency: 280,
    gcd: 2.5,
    id: 15989
} as const satisfies GcdAbility;

const fountain: GcdAbility = {
    name: 'Fountain',
    type: 'gcd',
    attackType: 'Weaponskill',
    potency: 340,
    gcd: 2.5,
    id: 15990
} as const satisfies GcdAbility;


const reverseCascade: GcdAbility = {
    name: 'Reverse Cascade',
    type: 'gcd',
    potency: 340,
    attackType: 'Weaponskill',
    gcd: 2.50
} as const satisfies GcdAbility;

const fountainFall: GcdAbility = {
    name: 'Fountainfall',
    type: 'gcd',
    potency: 400,
    attackType: 'Weaponskill',
    gcd: 2.50
} as const satisfies GcdAbility;

const saberDance: GcdAbility = {
    name: 'Saber Dance',
    type: 'gcd',
    potency: 540,
    attackType: 'Weaponskill',
    gcd: 2.50
} as const satisfies GcdAbility;

const starfall: GcdAbility = {
    name: 'Starfall Dance',
    type: 'gcd',
    potency: 600,
    attackType: 'Weaponskill',
    gcd: 2.50,
    autoCrit: true,
    autoDh: true
} as const satisfies GcdAbility;

const standardFinish: GcdAbility = {
    name: 'Standard Finish',
    type: 'gcd',
    potency: 720,
    attackType: 'Weaponskill',
    gcd: 1.50
} as const satisfies GcdAbility;

const techFinish: GcdAbility = {
    name: 'Technical Finish',
    type: 'gcd',
    potency: 1200,
    attackType: 'Weaponskill',
    gcd: 1.50,
    activatesBuffs: [TechnicalFinish]
} as const satisfies GcdAbility;

const tillana: GcdAbility = {
    name: 'Tillana',
    type: 'gcd',
    potency: 440,
    attackType: 'Weaponskill',
    gcd: 1.50
} as const satisfies GcdAbility;

const fanDance: OgcdAbility = {
    name: 'Fan Dance',
    type: 'ogcd',
    potency: 180,
    attackType: 'Ability',
    cooldown: {
        time: 1
    },
} as const satisfies OgcdAbility;

const fd3: OgcdAbility = {
    name: 'Fan Dance III',
    type: 'ogcd',
    potency: 220,
    attackType: 'Ability',
    cooldown: {
        time: 1
    },
} as const satisfies OgcdAbility;

const fd4: OgcdAbility = {
    name: 'Fan Dance IV',
    type: 'ogcd',
    potency: 340,
    attackType: 'Ability',
    cooldown: {
        time: 1
    },
} as const satisfies OgcdAbility;

const finishingMove: GcdAbility = {
    name: 'Finishing Move',
    type: 'gcd',
    potency: 820,
    attackType: 'Weaponskill',
    gcd: 2.50
} as const satisfies GcdAbility;

const lastDance: GcdAbility = {
    name: 'Last Dance',
    type: 'gcd',
    potency: 420,
    attackType: 'Weaponskill',
    gcd: 2.50
} as const satisfies GcdAbility;

const danceOfTheDawn: GcdAbility = {
    name: 'Dance of the Dawn',
    type: 'gcd',
    potency: 1000,
    attackType: 'Weaponskill',
    gcd: 2.50
} as const satisfies GcdAbility;

const auto: AutoAttack = {
    name: 'Auto Attack',
    type: 'autoattack',
    potency: 90,
    attackType: 'Auto-attack'
} as const satisfies AutoAttack;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const standardStep: GcdAbility = {
    name: 'Standard Step',
    type: 'gcd',
    potency: 0,
    attackType: 'Weaponskill',
    gcd: 1.50
} as const satisfies GcdAbility;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const techStep: GcdAbility = {
    name: 'Technical Step',
    type: 'gcd',
    potency: null,
    attackType: 'Weaponskill',
    gcd: 1.50
} as const satisfies GcdAbility;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stepsAction: GcdAbility = {
    name: 'Steps',
    type: 'gcd',
    potency: null,
    attackType: 'Weaponskill',
    gcd: 1.00
} as const satisfies GcdAbility;


export class DncDtSim extends BaseUsageCountSim<DncDtSimResults, DncDtSimSettings> {
    readonly spec = dncDtSheetSpec;
    displayName = 'DNC Sim';
    readonly shortName = dncDtSheetSpec.stub;
    readonly manualRun = false;

    constructor(settings?: ExternalCountSettings<DncDtSimSettings>) {
        super('DNC', settings);
    }

    totalCycleTime(set: CharacterGearSet): number {
        const gcdTime = set.computedStats.gcdPhys(2.5);

        const gcdDelay = 0.008;
        const startFinishDelay = 0.008;
        const stepDelay = 0.008;

        const gcdCount = 45;
        const gcdTimeWithDelay = gcdTime + gcdDelay;
        const gcdTimeTotal = gcdCount * gcdTimeWithDelay;
        const fixedGcdTimeTotal = 8.5;

        const startFinishCount = 3;
        const startFinishTime = startFinishCount * startFinishDelay;

        const stepCount = 4;
        const stepTime = stepCount * stepDelay;

        const totalTime = gcdTimeTotal + startFinishTime + stepTime + fixedGcdTimeTotal;
        const timeCap = 120;
        return Math.max(totalTime, timeCap);
    }


    /**
     * Returns the number of skills that fit in a buff duration, or total if the buff duration is null.
     *
     * This should be cumulative - e.g. the count for 'null' should be the total skills used. The count for '20' should
     * be the count of skills used in 20 second buffs, including 15 and 10 second buffs.
     *
     * @param set
     * @param buffDuration
     */
    skillsInBuffDuration(set: CharacterGearSet, buffDuration: number | null): SkillCount[] {

        // TODO
        const Esprit = 420;
        const Esprit_TF = 115;

        // Copied from google doc
        const SaberTotal = (Esprit / 50) - 1;
        const Saber20 = ((65 + Esprit_TF * 18.5 / 20) / 50 - 1);
        const Saber15 = Saber20 / 2;
        const Saber30 = 4 / 31 * (SaberTotal - Saber20) + Saber20;

        const CascadeTotal = (35 - SaberTotal) / 3;
        const Cascade20 = ((4 - Saber20) < 2 ? 0 : 1 / 3 * (2 - Saber20));
        const Cascade15 = 1 / 2 * Cascade20;
        const Cascade30 = 4 / 31 * (CascadeTotal - Cascade20) + Cascade20;

        const FountainTotal = (35 - SaberTotal) / 3;
        const Fountain20 = ((4 - Saber20) < 2 ? 0 : 1 / 3 * (2 - Saber20));
        const Fountain15 = 1 / 2 * Fountain20;
        const Fountain30 = 4 / 31 * (FountainTotal - Fountain20) + Fountain20;

        const FountainfallTotal = (FountainTotal / 2) + 2;
        const Fountainfall20 = 4 - Saber20 > 2 ? 1 + 1 / 6 * (5 - Saber20) : (4 - Saber20) > 1 ? 1 : 1 / 6 * (5 - Saber20);
        const Fountainfall15 = 1 / 2 * Fountainfall20;
        const Fountainfall30 = 4 / 31 * (FountainfallTotal - Fountainfall20) + Fountainfall20;

        const ReverseCascadeTotal = (CascadeTotal / 2) + 2;
        const ReverseCascade20 = ((4 - Saber20) > 2 ? 1 + 1 / 6 * (5 - Saber20) : (4 - Saber20 - Fountainfall20));
        const ReverseCascade15 = 1 / 2 * ReverseCascade20;
        const ReverseCascade30 = 4 / 31 * (ReverseCascadeTotal - ReverseCascade20) + ReverseCascade20;

        const StandardFinishTotal = 0;
        const StandardFinish15 = 0;
        const StandardFinish20 = 0;
        const StandardFinish30 = 0;

        const TillanaTotal = 1;
        const Tillana15 = 0;
        const Tillana20 = 1;
        const Tillana30 = 1;

        const FanDanceTotal = (ReverseCascadeTotal + FountainfallTotal) / 2;
        const FanDance20 = 3 + (ReverseCascade20 + Fountainfall20) / 2;
        const FanDance15 = 3 / 4 * FanDance20;
        const FanDance30 = 4 / 31 * (FanDanceTotal - FanDance20) + FanDance20;

        const FanDanceIIITotal = FanDanceTotal / 2 + 2;
        const FanDanceIII15 = FanDance15 / 2 + 1;
        const FanDanceIII20 = FanDance20 / 2 + 1;
        const FanDanceIII30 = 4 / 31 * (FanDanceIIITotal - FanDanceIII20) + FanDanceIII20;

        const FanDanceIVTotal = 2;
        const FanDanceIV15 = 1;
        const FanDanceIV20 = 1;
        const FanDanceIV30 = 1;

        const FinishingMoveTotal = 2;
        const FinishingMove15 = 1;
        const FinishingMove20 = 1;
        const FinishingMove30 = 1;

        const LastDanceTotal = 2;
        const LastDance15 = 1;
        const LastDance20 = 1;
        const LastDance30 = 1;

        const FullCycleTime = this.totalCycleTime(set);

        const common: SkillCount[] = [
            [danceOfTheDawn, 1],
            [techFinish, 1],
            [starfall, 1],

        ];
        let result: SkillCount[] = [];
        // Totals, regardless of buffs
        if (buffDuration === null) {
            result = [
                [saberDance, SaberTotal],
                [cascade, CascadeTotal],
                [fountain, FountainTotal],
                [reverseCascade, ReverseCascadeTotal],
                [fountainFall, FountainfallTotal],
                [standardFinish, StandardFinishTotal],
                [tillana, TillanaTotal],
                [fanDance, FanDanceTotal],
                [fd3, FanDanceIIITotal],
                [fd4, FanDanceIVTotal],
                [finishingMove, FinishingMoveTotal],
                [lastDance, LastDanceTotal],
            ]
        }
        // In buffs of at least 30 seconds
        else if (buffDuration >= 30) {
            result = [
                [saberDance, Saber30],
                [cascade, Cascade30],
                [fountain, Fountain30],
                [reverseCascade, ReverseCascade30],
                [fountainFall, Fountainfall30],
                [standardFinish, StandardFinish30],
                [tillana, Tillana30],
                [fanDance, FanDance30],
                [fd3, FanDanceIII30],
                [fd4, FanDanceIV30],
                [finishingMove, FinishingMove30],
                [lastDance, LastDance30],
            ]
        }
        // In buffs of at least 20 seconds
        else if (buffDuration >= 20) {
            result = [
                [saberDance, Saber20],
                [cascade, Cascade20],
                [fountain, Fountain20],
                [reverseCascade, ReverseCascade20],
                [fountainFall, Fountainfall20],
                [standardFinish, StandardFinish20],
                [tillana, Tillana20],
                [fanDance, FanDance20],
                [fd3, FanDanceIII20],
                [fd4, FanDanceIV20],
                [finishingMove, FinishingMove20],
                [lastDance, LastDance20],
            ]
        }
        // In buffs of at least 15 seconds
        else if (buffDuration >= 15) {
            result = [
                [saberDance, Saber15],
                [cascade, Cascade15],
                [fountain, Fountain15],
                [reverseCascade, ReverseCascade15],
                [fountainFall, Fountainfall15],
                [standardFinish, StandardFinish15],
                [tillana, Tillana15],
                [fanDance, FanDance15],
                [fd3, FanDanceIII15],
                [fd4, FanDanceIV15],
                [finishingMove, FinishingMove15],
                [lastDance, LastDance15],
            ]
        }
        else {
            return []
        }
        result.push(...common);
        result.push([auto, (buffDuration ?? FullCycleTime) / 3]);
        return result;
    }

    makeDefaultSettings(): DncDtSimSettings {
        return {}
    }
}