import {
    CustomRelicStatModel,
    EquippedItem, EquipSlotKey,
    EwRelicStatModel,
    GearItem,
    GearSetIssue,
    PartialRelicStatModel,
    RelicStatModel, RelicStats,
    Substat
} from "@xivgear/xivmath/geartypes";
import {
    ALL_SUB_STATS,
    getClassJobStats,
    JobName,
    STAT_ABBREVIATIONS,
    STAT_FULL_NAMES
} from "@xivgear/xivmath/xivconstants";
import {BaseParamMap} from "../datamanager";

function err(description: string): GearSetIssue {
    return {
        severity: 'error',
        description: description,
    };
}

function ewRelic(large: number, small: number): EwRelicStatModel {
    return {
        type: 'ewrelic',
        numSmall: 1,
        numLarge: 2,
        smallValue: small,
        largeValue: large,
        validate(item: EquippedItem, statToReport?: Substat): GearSetIssue[] {
            const out: GearSetIssue[] = [];
            let smalls = 0;
            let larges = 0;
            // If examining a single stat, only flag these as issues for this particular stat if this stat
            // is actually contributing to the problem.
            let reportSmall = !statToReport;
            let reportLarge = !statToReport;
            const caps = item.gearItem.unsyncedVersion.statCaps;
            for (const stat of ALL_SUB_STATS) {
                const current = item.relicStats[stat];
                const cap = caps[stat];
                if (current === undefined) {
                    continue;
                }
                if (current && cap && current > cap && (!statToReport || statToReport === stat)) {
                    out.push(err(`Stat ${STAT_ABBREVIATIONS[stat]} must be ${cap} or lower. `));
                }
                // Keep track of small/large counts
                if (current === this.smallValue) {
                    smalls++;
                    if (stat === statToReport) {
                        reportSmall = true;
                    }
                }
                else if (current === this.largeValue) {
                    larges++;
                    if (stat === statToReport) {
                        reportLarge = true;
                    }
                }
                else if (current !== 0 && (!statToReport || statToReport === stat)) {
                    // Also report if we have a non-zero value that is neither large nor small
                    out.push(err(`${current} is not a valid ${STAT_ABBREVIATIONS[stat]} amount - it should either be ${this.largeValue} or ${this.smallValue}`));
                }
            }
            if ((smalls > this.numSmall && reportSmall) || (larges > this.numLarge && reportLarge)) {
                out.push(err(`This relic should have two large stats and one small stat`));
            }
            return out;

        },
    };
}

function customRelic(total: number): CustomRelicStatModel {
    return {
        type: 'customrelic',
        totalCap: total,
        validate(item: EquippedItem, statToReport?: Substat): GearSetIssue[] {
            const out: GearSetIssue[] = [];
            let runningTotal = 0;
            const caps = item.gearItem.unsyncedVersion.statCaps;
            for (const stat of ALL_SUB_STATS) {
                const current = item.relicStats[stat];
                const cap = caps[stat];
                if (current && cap && current > cap && (!statToReport || statToReport === stat)) {
                    out.push(err(`Stat ${STAT_ABBREVIATIONS[stat]} must be ${cap} or lower. `));
                }
                if (current) {
                    runningTotal += current;
                }
            }
            // Warn for overcap
            if (runningTotal > this.totalCap) {
                const overcap = runningTotal - this.totalCap;
                // If reporting specific stat, make sure that stat is non-zero, and tailor the message based on whether
                // you would be able to fix the issue by reducing only that stat.
                if (statToReport) {
                    const reportingStatAmount = item.relicStats[statToReport];
                    // Skip if the stat being reported is zero to begin with
                    if (reportingStatAmount > 0) {
                        // If the issue can be fixed by reducing only the current stat, report that to the user
                        if (overcap <= reportingStatAmount) {
                            const reduceTo = reportingStatAmount - overcap;
                            out.unshift(err(`Sum of stats must be ${this.totalCap} or lower (currently ${runningTotal}). You could fix this by reducing ${STAT_ABBREVIATIONS[statToReport]} to ${reduceTo}.`));
                        }
                        else {
                            // Report the generic message if not
                            out.unshift(err(`Sum of stats must be ${this.totalCap} or lower (currently ${runningTotal}).`));
                        }
                    }
                }
                else {  // Otherwise, just report the generic message
                    out.unshift(err(`Sum of stats must be ${this.totalCap} or lower (currently ${runningTotal}).`));
                }
            }
            return out;
        },
    };
}

/**
 * Get a relic stat model for an item
 *
 * @param gearItem The item
 * @param baseParams Data for BaseParams
 * @param job The job
 */
export function getRelicStatModelFor(gearItem: GearItem, baseParams: BaseParamMap, job: JobName): RelicStatModel | null {
    const partial = getRelicStatModelForPartial(gearItem, baseParams);
    if (partial === null) {
        return null;
    }
    else {
        const jobData = getClassJobStats(job);
        return {
            excludedStats: jobData.excludedRelicSubstats,
            ...partial,
            validate(item: EquippedItem, statToReport?: Substat): GearSetIssue[] {
                const failures = [...partial.validate(item, statToReport)];
                const relicStats = item.relicStats;
                if (statToReport) {
                    if (relicStats[statToReport] && jobData.excludedRelicSubstats.includes(statToReport)) {
                        failures.push(err(`${STAT_FULL_NAMES[statToReport]} is not available on ${jobData.role.toLowerCase()} relics.`));
                    }
                }
                else {
                    for (const entry of Object.entries(relicStats)) {
                        const stat = entry[0] as Substat;
                        if (entry[1] && jobData.excludedRelicSubstats.includes(stat)) {
                            failures.push(err(`Stat ${STAT_FULL_NAMES[stat]} is not available on ${jobData.role.toLowerCase()} relics.`));
                        }
                    }
                }
                return failures;
            },
        };
    }
}

function getRelicStatModelForPartial(gearItem: GearItem, baseParams: BaseParamMap): PartialRelicStatModel | null {
    if (!gearItem.isCustomRelic) {
        return null;
    }
    // BaseParam tells you that 2h = 140%, 1h = 100%, and shield = 40%
    // Just use crit, it should be the same for all of them
    const slotModifier = baseParams.crit[gearItem.occGearSlotName] / 140;
    const statCap = gearItem.unsyncedVersion.statCaps.crit;
    switch (gearItem.ilvl) {
    // EW relics are 2 capped stats, and one 72
        case 665:
            return ewRelic(statCap, Math.round(72 * slotModifier));
        case 645:
            return ewRelic(statCap, Math.round(72 * slotModifier));
        case 535:
            return customRelic(Math.round(468 * slotModifier));
        case 515:
            return customRelic(Math.round(462 * slotModifier));
    }
    return {
        type: "unknown",
        validate(item: EquippedItem, statToReport?: Substat): GearSetIssue[] {
            const out: GearSetIssue[] = [];
            const caps = item.gearItem.unsyncedVersion.statCaps;
            const stats: readonly Substat[] = (statToReport ? [statToReport] as const : ALL_SUB_STATS);
            for (const stat of stats) {
                const current: number = item.relicStats[stat as Substat];
                const cap = caps[stat as Substat];
                if (current && cap && current > cap) {
                    out.push({
                        severity: 'error',
                        description: `Stat ${STAT_ABBREVIATIONS[stat as Substat]} must be ${cap} or lower.`,
                    });
                }
            }
            return out;
        },
    };
}

