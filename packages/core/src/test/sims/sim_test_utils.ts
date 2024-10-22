/* eslint-disable @typescript-eslint/no-explicit-any */
import {isClose} from "@xivgear/core/test/test_utils";
import {FinalizedAbility, PartyBuff} from "@xivgear/core/sims/sim_types";
import {CycleSimResult, CycleSimResultFull, DisplayRecordFinalized} from "@xivgear/core/sims/cycle_sim";
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";

/**
 * Type that represents the time, name, and damage of an ability
 */
export type UseResult = {
    time: number,
    name: string,
    damage: number
}

/**
 * Helper func to enable/disable a party buff without having to do the full lookup every time, since the
 * buffManager presents everything in a very UI-centric way.
 *
 * @param sim The cycle sim instance
 * @param buff The buff to enable
 * @param enabled Whether to enable or disable the buff
 */
export function setPartyBuffEnabled(sim: BaseMultiCycleSim<any, any>, buff: PartyBuff, enabled: boolean) {
    const jobSettings = sim.buffManager.allJobs.find(j => j.job === buff.job);
    jobSettings.enabled = true;
    const buffSettings = jobSettings.enabledBuffs.find(b => b.buff.name === buff.name);
    buffSettings.enabled = true;
}

export function assertSimAbilityResults(result: CycleSimResultFull<CycleSimResult> | CycleSimResult | readonly DisplayRecordFinalized[], expectedAbilities: UseResult[]) {

    let displayRecords: readonly DisplayRecordFinalized[];
    if ('all' in result) {
        result = result.best;
    }
    if ('displayRecords' in result) {
        displayRecords = result.displayRecords;
    }
    else {
        displayRecords = result;
    }
    const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
        return 'ability' in record;
    });
    const failures: string[] = [];
    const length = Math.max(actualAbilities.length, expectedAbilities.length);
    for (let i = 0; i < length; i++) {
        if (i >= actualAbilities.length) {
            failures.push(`Item ${i} failed: Expected ${JSON.stringify(expectedAbilities[i])}, but there were no more actual abilities`);
            continue;
        }
        const actualUse = actualAbilities[i];
        const actual: UseResult = {
            damage: actualUse.totalDamage,
            name: actualUse.ability.name,
            time: actualUse.usedAt,
        };
        if (i >= expectedAbilities.length) {
            failures.push(`Item ${i} failed: Expected to be done, but there was another ability (${JSON.stringify(actual)}`);
        }
        else {
            const expected = expectedAbilities[i];
            if (expected.name !== actual.name) {
                failures.push(`Item ${i} failed: Expected ability '${expected.name}', but it was '${actual.name}'`);
            }
            if (!isClose(actual.damage, expected.damage, 0.01)) {
                // Print 3 digits so that roundoff doesn't become an issue.
                // e.g. 0.507 and 0.519 have a delta > 0.01, but it would round to a delta of exactly 0.01
                failures.push(`Item ${i} failed: Wrong damage, expected ${expected.damage.toFixed(3)}, but it was ${actual.damage.toFixed(3)}`);
            }
            if (!isClose(actual.time, expected.time, 0.0001)) {
                failures.push(`Item ${i} failed: Expected time ${expected.time.toFixed(5)}, but it was ${actual.time.toFixed(5)}`);
            }
        }
    }
    if (failures.length > 0) {
        const asStr = failures.join('\n');
        throw Error(asStr);
    }
}
