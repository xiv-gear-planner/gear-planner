import {AutoAttack, GcdAbility, OgcdAbility, SimSpec} from "@xivgear/core/sims/sim_types";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseUsageCountSim, CountSimResult, ExternalCountSettings, SkillCount} from "../processors/count_sim";

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
    gcd: 2.50
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
    gcd: 1.50
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
    potency: 93.6,
    attackType: 'Auto-attack'
} as const satisfies AutoAttack;

const standardStep: GcdAbility = {
    name: 'Standard Step',
    type: 'gcd',
    potency: 0,
    attackType: 'Weaponskill',
    gcd: 1.50
} as const satisfies GcdAbility;

const techStep: GcdAbility = {
    name: 'Technical Step',
    type: 'gcd',
    potency: null,
    attackType: 'Weaponskill',
    gcd: 1.50
} as const satisfies GcdAbility;

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
        const gcd = set.computedStats.gcdPhys(2.5);
        // Totals, regardless of buffs
        if (buffDuration === null) {
            return [[cascade, 3.6 / gcd], [fountain, 3.6 / gcd]]
        }
        // In buffs of at least 20 seconds
        else if (buffDuration >= 20) {
            return [[cascade, 0.5 / gcd], [fountain, 0.5 / gcd]]
        }
        // etc
        else {
            return []
        }
    }

    makeDefaultSettings(): DncDtSimSettings {
        return {}
    }
}