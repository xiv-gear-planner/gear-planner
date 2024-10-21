import {AutoAttack, GcdAbility, OgcdAbility, SimSpec} from "@xivgear/core/sims/sim_types";
import {CharacterGearSet} from "@xivgear/core/gear";
import {TechnicalFinish} from "@xivgear/core/sims/buffs";
import { ExternalCountSettings, CountSimResult, BaseUsageCountSim, SkillCount } from "@xivgear/core/sims/processors/count_sim";

export const dncDtSheetSpec: SimSpec<DncDtSim, DncDtSimSettings> = {
    displayName: "DNC Level 100 Sim",
    loadSavedSimInstance(exported: ExternalCountSettings<DncDtSimSettings>) {
        return new DncDtSim(exported);
    },
    makeNewSimInstance(): DncDtSim {
        return new DncDtSim();
    },
    stub: "dnc-dt-sim",
    supportedJobs: ['DNC',],
    supportedLevels: [100,],
    isDefaultSim: true,
};

export type DncDtSimSettings = NonNullable<unknown>


export interface DncDtSimResults extends CountSimResult {
}

const cascade: GcdAbility = {
    name: 'Cascade',
    type: 'gcd',
    attackType: 'Weaponskill',
    potency: 220,
    gcd: 2.5,
    id: 15989,
} as const satisfies GcdAbility;

const fountain: GcdAbility = {
    name: 'Fountain',
    type: 'gcd',
    attackType: 'Weaponskill',
    potency: 280,
    gcd: 2.5,
    id: 15990,
} as const satisfies GcdAbility;


const reverseCascade: GcdAbility = {
    name: 'Reverse Cascade',
    type: 'gcd',
    potency: 280,
    attackType: 'Weaponskill',
    gcd: 2.50,
    id: 15991,
} as const satisfies GcdAbility;

const fountainFall: GcdAbility = {
    name: 'Fountainfall',
    type: 'gcd',
    potency: 340,
    attackType: 'Weaponskill',
    gcd: 2.50,
    id: 15992,
} as const satisfies GcdAbility;

const saberDance: GcdAbility = {
    name: 'Saber Dance',
    type: 'gcd',
    potency: 520,
    attackType: 'Weaponskill',
    gcd: 2.50,
    id: 16005,
} as const satisfies GcdAbility;

const starfall: GcdAbility = {
    name: 'Starfall Dance',
    type: 'gcd',
    potency: 600,
    attackType: 'Weaponskill',
    gcd: 2.50,
    autoCrit: true,
    autoDh: true,
    id: 25792,
} as const satisfies GcdAbility;

const standardFinish: GcdAbility = {
    name: 'Standard Finish',
    type: 'gcd',
    potency: 850,
    attackType: 'Weaponskill',
    gcd: 1.50,
    fixedGcd: true,
    id: 16003,
} as const satisfies GcdAbility;

const techFinish: GcdAbility = {
    name: 'Technical Finish',
    type: 'gcd',
    potency: 1300,
    attackType: 'Weaponskill',
    gcd: 1.50,
    fixedGcd: true,
    activatesBuffs: [TechnicalFinish,],
    id: 16004,
} as const satisfies GcdAbility;

const tillana: GcdAbility = {
    name: 'Tillana',
    type: 'gcd',
    potency: 600,
    attackType: 'Weaponskill',
    gcd: 2.50,
    fixedGcd: true,
    id: 25790,
} as const satisfies GcdAbility;

const fanDance: OgcdAbility = {
    name: 'Fan Dance',
    type: 'ogcd',
    potency: 150,
    attackType: 'Ability',
    cooldown: {
        time: 1,
    },
    id: 16007,
} as const satisfies OgcdAbility;

const fd3: OgcdAbility = {
    name: 'Fan Dance III',
    type: 'ogcd',
    potency: 200,
    attackType: 'Ability',
    cooldown: {
        time: 1,
    },
    id: 16009,
} as const satisfies OgcdAbility;

const fd4: OgcdAbility = {
    name: 'Fan Dance IV',
    type: 'ogcd',
    potency: 420,
    attackType: 'Ability',
    cooldown: {
        time: 1,
    },
    id: 25791,
} as const satisfies OgcdAbility;

const finishingMove: GcdAbility = {
    name: 'Finishing Move',
    type: 'gcd',
    potency: 850,
    attackType: 'Weaponskill',
    gcd: 2.50,
    // TODO: dt skill
    id: 40001,
} as const satisfies GcdAbility;

const lastDance: GcdAbility = {
    name: 'Last Dance',
    type: 'gcd',
    potency: 520,
    attackType: 'Weaponskill',
    gcd: 2.50,
    // TODO: dt skill
    id: 40002,
} as const satisfies GcdAbility;

const danceOfTheDawn: GcdAbility = {
    name: 'Dance of the Dawn',
    type: 'gcd',
    potency: 1000,
    attackType: 'Weaponskill',
    gcd: 2.50,
    // TODO: dt skill
    id: 40003,
} as const satisfies GcdAbility;

const auto: AutoAttack = {
    name: 'Auto Attack',
    type: 'autoattack',
    potency: 90,
    attackType: 'Auto-attack',
    id: 7,
} as const satisfies AutoAttack;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const standardStep: GcdAbility = {
    name: 'Standard Step',
    type: 'gcd',
    potency: 0,
    attackType: 'Weaponskill',
    gcd: 1.50,
    fixedGcd: true,
    id: 15997,
} as const satisfies GcdAbility;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const techStep: GcdAbility = {
    name: 'Technical Step',
    type: 'gcd',
    potency: null,
    attackType: 'Weaponskill',
    gcd: 1.50,
    fixedGcd: true,
    id: 15997,
} as const satisfies GcdAbility;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stepsAction: GcdAbility = {
    name: 'Steps',
    type: 'gcd',
    potency: null,
    attackType: 'Weaponskill',
    gcd: 1.00,
    fixedGcd: true,
    id: 15998,
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

        const cfRot = this.getCfRotQty(set, 22, 11); // 22s total of non-gcd-scaling stuff, 11 guaranteed GCDs
        const gcdCount = cfRot.rotationCount;
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

    private getCfRotQty(set: CharacterGearSet, nonCFStatic: number, nonCFGcd: number): {
        cascadeFountainCount: number,
        rotationCount: number
    } {

        const gcd = set.computedStats.gcdPhys(2.5);
        const cfCount = Math.floor((120 - nonCFStatic - (gcd * nonCFGcd)) / gcd);
        return {
            cascadeFountainCount: cfCount,
            rotationCount: cfCount + nonCFGcd,
        };
        /*
        if (gcd >= 2.46) {
            return {
                cascadeFountainCount: 28,
            }
        }
        else if (gcd >= 2.40) {
            return {
                cascadeFountainCount: 29,
            }
        }
        else if (gcd >= 2.35) {
            return {
                cascadeFountainCount: 30,
            }
        }
        else if (gcd >= 2.30) {
            return {
                cascadeFountainCount: 31,
            }
        }
        else if (gcd >= 2.25) {
            return {
                cascadeFountainCount: 32,
            }
        }
        else {
            return {
                cascadeFountainCount: 33,
            }
        }
            */
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
        // Taken from the calcs done in the gearset picking some random comp
        const Esprit = 407.8;
        const EspiritTF = 115.9514882;


        // Copied from google doc
        const TillanaTotal = 1;
        const Tillana15 = 0;
        const Tillana20 = 1;
        const Tillana30 = 1;

        const StarfallTotal = 1;

        const TechFinishTotal = 1;

        const DanceOfTheDawnTotal = 1;

        const StandardFinishTotal = 2;
        const StandardFinish15 = 0;
        const StandardFinish20 = 0;
        const StandardFinish30 = 0;

        const FanDanceIVTotal = 2;
        const FanDanceIV15 = 1;
        const FanDanceIV20 = 1;
        const FanDanceIV30 = 1;

        const FinishingMoveTotal = 2;
        const FinishingMove15 = 1;
        const FinishingMove20 = 1;
        const FinishingMove30 = 1;

        const LastDanceTotal = 4;
        const LastDance15 = 1;
        const LastDance20 = 2;
        const LastDance30 = 2;

        const staticTime = 7 * TechFinishTotal + 5 * StandardFinishTotal + 2.5 * FinishingMoveTotal;
        const numNonCfGcds = TillanaTotal + LastDanceTotal + StarfallTotal + DanceOfTheDawnTotal + 4; // +4 for flourish procs
        const cf = this.getCfRotQty(set, staticTime, numNonCfGcds).cascadeFountainCount;

        const SaberTotal = Esprit / 50 - 1;
        const Saber20 = Math.min((65 + EspiritTF * 18.5 / 20) / 50, 2);
        const Saber15 = Saber20 / 2;
        const Saber30 = 4 / 31 * (SaberTotal - Saber20) + Saber20;

        const CascadeTotal = (cf - SaberTotal) / 3;
        const Cascade20 = 0;//4 - Saber20 < 2 ? 0 : 1 / 3 * (2 - Saber20);
        const Cascade15 = 1 / 2 * Cascade20;
        const Cascade30 = 4 / 31 * (CascadeTotal - Cascade20) + Cascade20;

        const FountainTotal = (cf - SaberTotal) / 3;
        const Fountain20 = 0;//4 - Saber20 < 2 ? 0 : 1 / 3 * (2 - Saber20);
        const Fountain15 = 1 / 2 * Fountain20;
        const Fountain30 = 4 / 31 * (FountainTotal - Fountain20) + Fountain20;

        const FountainfallTotal = FountainTotal / 2 + 2;
        //const Fountainfall20 = 4 - Saber20 > 2 ? 1 + 1 / 6 * (5 - Saber20) : 4 - Saber20 > 1 ? 1 : 1 / 6 * (5 - Saber20);
        const Fountainfall20 = Math.min(2 - Saber20, 1);
        const Fountainfall15 = 1 / 2 * Fountainfall20;
        const Fountainfall30 = 4 / 31 * (FountainfallTotal - Fountainfall20) + Fountainfall20;

        const ReverseCascadeTotal = CascadeTotal / 2 + 2;
        //const ReverseCascade20 = 4 - Saber20 > 2 ? 1 + 1 / 6 * (5 - Saber20) : 4 - Saber20 - Fountainfall20;
        const ReverseCascade20 = Math.max(Fountainfall20, 0);
        const ReverseCascade15 = 1 / 2 * ReverseCascade20;
        const ReverseCascade30 = 4 / 31 * (ReverseCascadeTotal - ReverseCascade20) + ReverseCascade20;

        const FanDanceTotal = (ReverseCascadeTotal + FountainfallTotal) / 2;
        const FanDance20 = 3.5 + (ReverseCascade20 + Fountainfall20) / 2;
        const FanDance15 = 3 / 4 * FanDance20;
        const FanDance30 = 4 / 31 * (FanDanceTotal - FanDance20) + FanDance20;

        const FanDanceIIITotal = FanDanceTotal / 2 + 2;
        const FanDanceIII15 = FanDance15 / 2 + 1;
        const FanDanceIII20 = FanDance20 / 2 + 1;
        const FanDanceIII30 = 4 / 31 * (FanDanceIIITotal - FanDanceIII20) + FanDanceIII20;

        const FullCycleTime = this.totalCycleTime(set);

        const common: SkillCount[] = [
            [danceOfTheDawn, 1,],
            [starfall, 1,],

        ];
        let result: SkillCount[] = [];
        // Totals, regardless of buffs
        if (buffDuration === null) {
            result = [
                [saberDance, SaberTotal,],
                [cascade, CascadeTotal,],
                [fountain, FountainTotal,],
                [reverseCascade, ReverseCascadeTotal,],
                [fountainFall, FountainfallTotal,],
                [standardFinish, StandardFinishTotal,],
                [tillana, TillanaTotal,],
                [fanDance, FanDanceTotal,],
                [fd3, FanDanceIIITotal,],
                [fd4, FanDanceIVTotal,],
                [finishingMove, FinishingMoveTotal,],
                [lastDance, LastDanceTotal,],
                [techFinish, 1,],
            ];
        }
        else if (buffDuration >= 30) { // In buffs of at least 30 seconds
            result = [
                [saberDance, Saber30,],
                [cascade, Cascade30,],
                [fountain, Fountain30,],
                [reverseCascade, ReverseCascade30,],
                [fountainFall, Fountainfall30,],
                [standardFinish, StandardFinish30,],
                [tillana, Tillana30,],
                [fanDance, FanDance30,],
                [fd3, FanDanceIII30,],
                [fd4, FanDanceIV30,],
                [finishingMove, FinishingMove30,],
                [lastDance, LastDance30,],
            ];
        }
        else if (buffDuration >= 20) {  // In buffs of at least 20 seconds
            result = [
                [saberDance, Saber20,],
                [cascade, Cascade20,],
                [fountain, Fountain20,],
                [reverseCascade, ReverseCascade20,],
                [fountainFall, Fountainfall20,],
                [standardFinish, StandardFinish20,],
                [tillana, Tillana20,],
                [fanDance, FanDance20,],
                [fd3, FanDanceIII20,],
                [fd4, FanDanceIV20,],
                [finishingMove, FinishingMove20,],
                [lastDance, LastDance20,],
            ];
        }
        else if (buffDuration >= 15) {  // In buffs of at least 15 seconds
            result = [
                [saberDance, Saber15,],
                [cascade, Cascade15,],
                [fountain, Fountain15,],
                [reverseCascade, ReverseCascade15,],
                [fountainFall, Fountainfall15,],
                [standardFinish, StandardFinish15,],
                [tillana, Tillana15,],
                [fanDance, FanDance15,],
                [fd3, FanDanceIII15,],
                [fd4, FanDanceIV15,],
                [finishingMove, FinishingMove15,],
                [lastDance, LastDance15,],
            ];
        }
        else {
            return [];
        }
        result.push(...common);
        result.push([auto, (buffDuration ?? FullCycleTime) / set.computedStats.aaDelay,]);
        return result;
    }

    makeDefaultSettings(): DncDtSimSettings {
        return {};
    }
}
