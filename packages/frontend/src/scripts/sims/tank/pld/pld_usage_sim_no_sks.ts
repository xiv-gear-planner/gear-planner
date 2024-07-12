import {SimSpec} from "@xivgear/core/sims/sim_types";
import {CharacterGearSet} from "@xivgear/core/gear";
import {BaseUsageCountSim, CountSimResult, ExternalCountSettings, SkillCount} from "../../processors/count_sim";
import * as Actions from "./pld_actions_no_sks"

export const pldUsageSimSpec: SimSpec<PldUsageSim, PldUsageSimSettings> = {
    displayName: "PLD Lv100 Sim (sks not fully supported)",
    loadSavedSimInstance(exported: ExternalCountSettings<PldUsageSimSettings>) {
        return new PldUsageSim(exported);
    },
    makeNewSimInstance(): PldUsageSim {
        return new PldUsageSim();
    },
    stub: "pld-usage-sim",
    supportedJobs: ['PLD'],
    supportedLevels: [100],
    isDefaultSim: true
};

export type PldUsageSimSettings = NonNullable<unknown>


export interface PldUsageSimResults extends CountSimResult {
}

export class PldUsageSim extends BaseUsageCountSim<PldUsageSimResults, PldUsageSimSettings> {
    readonly spec = pldUsageSimSpec;
    displayName = pldUsageSimSpec.displayName;
    readonly shortName = pldUsageSimSpec.stub;
    readonly manualRun = false;

    constructor(settings?: ExternalCountSettings<PldUsageSimSettings>) {
        super('PLD', settings);
    }

    makeDefaultSettings(): PldUsageSimSettings {
        return {}
    }

    totalCycleTime(set: CharacterGearSet): number {
        return 420;
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
        let result: SkillCount[] = [];

        if (buffDuration === null) {
            result = [
                [Actions.buffed(Actions.conf), 7],
                [Actions.buffed(Actions.faith), 7],
                [Actions.buffed(Actions.truth), 7],
                [Actions.buffed(Actions.valor), 7],
                [Actions.buffed(Actions.goring), 7],
                [Actions.buffed(Actions.royal), 3],
                [Actions.buffed(Actions.atone), 2],
                [Actions.buffed(Actions.supp), 4],
                [Actions.buffed(Actions.sep), 6],
                [Actions.buffed(Actions.hs), 6],
                [Actions.fast, 19],
                [Actions.riot, 19],
                [Actions.royal, 16],
                [Actions.atone, 17],
                [Actions.supp, 15],
                [Actions.sep, 13],
                [Actions.hs, 13],
            ];
        } else if (buffDuration >= 30) {
            result = [
                [Actions.buffed(Actions.conf), 7],
                [Actions.buffed(Actions.faith), 7],
                [Actions.buffed(Actions.truth), 7],
                [Actions.buffed(Actions.valor), 7],
                [Actions.buffed(Actions.goring), 7],
                [Actions.buffed(Actions.atone), 2],
                [Actions.buffed(Actions.royal), 3],
                [Actions.buffed(Actions.supp), 4],
                [Actions.buffed(Actions.sep), 6],
                [Actions.buffed(Actions.hs), 6],
                [Actions.fast, 4],
                [Actions.riot, 4],
                [Actions.royal, 4],
                [Actions.atone, 4],
                [Actions.supp, 5],
                [Actions.sep, 4],
                [Actions.hs, 3],
            ];
        } else if (buffDuration >= 20) {
            result = [
                [Actions.buffed(Actions.conf), 7],
                [Actions.buffed(Actions.faith), 7],
                [Actions.buffed(Actions.truth), 7],
                [Actions.buffed(Actions.valor), 7],
                [Actions.buffed(Actions.goring), 7],
                [Actions.buffed(Actions.royal), 3],
                [Actions.buffed(Actions.atone), 2],
                [Actions.buffed(Actions.supp), 4],
                [Actions.buffed(Actions.sep), 6],
                [Actions.buffed(Actions.hs), 6],
            ];
        } else if (buffDuration >= 15) {
            result = [
                [Actions.buffed(Actions.conf), 7],
                [Actions.buffed(Actions.faith), 7],
                [Actions.buffed(Actions.truth), 7],
                [Actions.buffed(Actions.valor), 7],
                [Actions.buffed(Actions.goring), 7],
                [Actions.buffed(Actions.royal), 1],
                [Actions.buffed(Actions.atone), 1],
                [Actions.buffed(Actions.supp), 3],
                [Actions.buffed(Actions.sep), 2],
            ];
        } else {
            return [];
        }

        const buffedOgcds: SkillCount[] = [
            [Actions.buffed(Actions.imp), 7],
            [Actions.buffed(Actions.cos), 7],
            [Actions.buffed(Actions.exp), 7],
            [Actions.buffed(Actions.int), 14],
            [Actions.buffed(Actions.honor), 7],
        ];
        const unbuffedOgcds: SkillCount[] = [
            [Actions.cos, 7],
            [Actions.exp, 7],
        ];

        result.push(...buffedOgcds);
        if (!buffDuration) {
            result.push(...unbuffedOgcds);
        }

        // autos
        if (buffDuration === null) {
            result.push([Actions.auto, 280 / 2.24]) // unbuffed autos 2/3 of the time
            result.push([Actions.buffed(Actions.auto), 140 / 2.24])
        } else if (buffDuration >= 30) {
            result.push([Actions.auto, 70 / 2.24])
            result.push([Actions.buffed(Actions.auto), 140 / 2.24])
        } else if (buffDuration >= 15) {
            result.push([Actions.buffed(Actions.auto), 7 * buffDuration / set.computedStats.aaDelay])
        }

        return result;
    }
}