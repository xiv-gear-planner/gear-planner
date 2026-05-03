import {
    ComputedSetStats,
    EquipmentSet,
    EquippedItem,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    MeldableMateriaSlot,
    MicroSetExport,
    RawStats,
    SetExport
} from "@xivgear/xivmath/geartypes";
import {
    ALL_SUB_STATS,
    MATERIA_ACCEPTABLE_OVERCAP_LOSS,
    MateriaSubstat,
    NORMAL_GCD
} from "@xivgear/xivmath/xivconstants";
import {sksToGcd, spsToGcd} from "@xivgear/xivmath/xivmath";
import {CharacterGearSet} from "../gear";
import {GearPlanSheet} from "../sheet";
import {GearsetGenerationStatusUpdate} from "./types";
import {setToMicroExport} from "../workers/worker_utils";


export class GearsetGenerationSettings {
    gearset: CharacterGearSet;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd: number;
    overwriteFood: boolean;
    filterFood: boolean;

    constructor(gearset: CharacterGearSet, overwrite: boolean, useTargetGcd: boolean, targetGcd: number, solveFood: boolean = false, filterFood: boolean = false) {
        this.gearset = gearset;
        this.overwriteExistingMateria = overwrite;
        this.useTargetGcd = useTargetGcd;
        this.targetGcd = targetGcd;
        this.overwriteFood = solveFood;
        this.filterFood = filterFood;
    }

    static export(settings: GearsetGenerationSettings, sheet: GearPlanSheet): GearsetGenerationSettingsExport {
        return {
            gearset: sheet.exportGearSet(settings.gearset),
            overwriteExistingMateria: settings.overwriteExistingMateria,
            useTargetGcd: settings.useTargetGcd,
            targetGcd: settings.targetGcd,
            overwriteFood: settings.overwriteFood,
            allowedFoodIds: settings.filterFood ? sheet.foodItemsForDisplay.map(f => f.id) : undefined,
        };
    }
}

export type GearsetGenerationSettingsExport = {
    gearset: SetExport;
    overwriteExistingMateria: boolean;
    useTargetGcd: boolean;
    targetGcd: number;
    overwriteFood: boolean;
    allowedFoodIds?: number[];
}

class ItemWithStats {
    item: EquippedItem;
    stats: RawStats;

    constructor(item: EquippedItem, stats: RawStats) {
        this.item = item;
        this.stats = stats;
    }
}

class EquipmentSetWithStats {
    set: EquipmentSet;
    stats: RawStats;

    constructor(set: EquipmentSet, stats: RawStats) {
        this.set = set;
        this.stats = stats;
    }
}

function getRotationCacheKey(stats: ComputedSetStats): RotationCacheKey {
    const sps = stats.spellspeed;
    const sks = stats.skillspeed;
    const wdly = stats.weaponDelay;
    // Supports up to 26.2144s weapon delay, 65536 sks, 65536 sps while staying in 50 bits (53 bits is safe for JS integers)
    // Floor just in case a 5th digit somehow got in there
    // Can't use << because for some reason it converts to int32 first
    return sps * Math.pow(2, 34) + sks * Math.pow(2, 18) + Math.floor(wdly * 10_000);
}

type AllStatDedupKey = string;
type RotationCacheKey = number;

/**
 * Produces possible gearsets for solving
 */
export class GearsetGenerator {

    readonly _sheet: GearPlanSheet;
    readonly relevantStats: MateriaSubstat[];

    public constructor(sheet: GearPlanSheet) {
        this._sheet = sheet;
        this.relevantStats = ALL_SUB_STATS.filter(stat => this._sheet.isStatRelevant(stat) && stat !== 'piety');
    }

    async getMeldPossibilitiesForGearset(gearset: CharacterGearSet, settings: GearsetGenerationSettingsExport, genCallback: (sets: MicroSetExport[]) => void, statusCallback: (update: Omit<GearsetGenerationStatusUpdate, "type">) => void): Promise<void> {
        console.log("Meld generator: Init");
        statusCallback({
            phase: 0,
            count: 0,
        });
        const levelStats = gearset.computedStats.levelStats;
        const override = this._sheet.classJobStats.gcdDisplayOverrides?.(this._sheet.level) ?? [];
        const useSks = gearset.isStatRelevant('skillspeed');
        const over = override.find(over => over.basis === (useSks ? 'sks' : 'sps'));
        const attackType = over ? over.attackType : useSks ? 'Weaponskill' : 'Spell';
        const haste = gearset.computedStats.haste(attackType, over?.buffHaste ?? 0, over?.gaugeHaste ?? 0);

        const equipment = this.cloneEquipmentset(gearset.equipment);

        if (settings.overwriteExistingMateria) {
            for (const slotKey of EquipSlots) {
                const equipSlot = equipment[slotKey] as EquippedItem | null;
                const gearItem = equipSlot?.gearItem;
                if (gearItem) {
                    equipSlot.melds.forEach(meldSlot => {
                        // Don't overwrite locked slots
                        if (!meldSlot.locked) {
                            meldSlot.equippedMateria = null;
                        }
                    });
                }
            }
        }

        let possibleMeldCombinations = new Map<AllStatDedupKey, EquipmentSetWithStats>();
        const baseEquipSet = new EquipmentSetWithStats(new EquipmentSet, new RawStats);

        console.log("Meld generator: Phase 1 (Individual slot combinations)");
        statusCallback({
            phase: 1,
            count: 0,
        });

        // Generate these first to avoid re-doing them. Also saves memory by letting our EquipmentSets shallow copy EquippedItems which all reside in here.
        const allIndividualGearPieces: Map<EquipSlotKey, ItemWithStats[]> = new Map<EquipSlotKey, ItemWithStats[]>();
        for (const slotKey of EquipSlots) {
            if (equipment[slotKey] === null || equipment[slotKey] === undefined) {
                continue;
            }

            console.log(`Meld generator: generating combinations for ${slotKey}`);
            const pieceCombinations = this.getAllMeldCombinationsForGearItem(equipment[slotKey]);
            console.log(`Meld generator: ${pieceCombinations.length} combinations for ${slotKey}`);
            allIndividualGearPieces.set(slotKey, pieceCombinations);
        }

        possibleMeldCombinations.set(this.statsToKey(baseEquipSet.stats), baseEquipSet);

        console.log("Meld generation: Phase 2 (full set meld combinations + dedupe)");
        statusCallback({
            phase: 2,
            count: 0,
        });
        /**
         * Basic Algorithm (here n = number of equipment slots filled)
         * n = 0: Return all melds for 0th gear slot
         * n > 0: Find all possible combinations for n-1. For each of these, append all melds for n'th gear slot
         *
         * Solve n=0, then iterate through n=11, caching the previous results.
         * This is O(m^11), where m is the number of unique-statted ways to meld one gear piece.
         * It may be better than O(m^11) if discarding duplicate/worse sets improves the complexity. idk
         * This code is very hot.
         */
        for (let i = 0; i < EquipSlots.length; i++) {
            const slotKey = EquipSlots[i];

            if (equipment[slotKey] === null || equipment[slotKey] === undefined) {
                continue;
            }

            statusCallback({
                phase: 2,
                count: possibleMeldCombinations.size,
                subPhase: {
                    phase: i,
                    phaseMax: EquipSlots.length,
                },
            });

            const newGearsets = new Map<AllStatDedupKey, EquipmentSetWithStats>();
            for (const currSet of possibleMeldCombinations.values()) {

                for (const currPiece of allIndividualGearPieces.get(slotKey).values()) {

                    const setStatsWithPiece = this.addStats({...currSet.stats}, currPiece.stats);
                    const setPlusNewPieceKey = this.statsToKey(setStatsWithPiece);

                    const gcd = useSks ? sksToGcd(NORMAL_GCD, levelStats, setStatsWithPiece['skillspeed'], haste)
                        : spsToGcd(NORMAL_GCD, levelStats, setStatsWithPiece['spellspeed'], haste);

                    // Don't put in duplicates in terms of stats.
                    // Also exclude anything that is already past our target GCD, because there's no anti-sks that will slow the set down to target.
                    if (!newGearsets.has(setPlusNewPieceKey)
                        && (!settings.useTargetGcd || gcd >= settings.targetGcd)) {

                        const setPlusNewPiece = this.cloneEquipmentSetWithStats(currSet);
                        setPlusNewPiece.set[slotKey] = currPiece.item;
                        setPlusNewPiece.stats = setStatsWithPiece;

                        newGearsets.set(setPlusNewPieceKey, setPlusNewPiece);
                    }
                }
            }

            possibleMeldCombinations = newGearsets;
        }
        console.log(`Meld generation: Phase 2 found ${possibleMeldCombinations.size} combinations`);

        statusCallback({
            phase: 3,
            count: possibleMeldCombinations.size,
        });
        console.log("Meld generation: Phase 3 (food and GCD sorting)");
        const gcdMap = new Map<RotationCacheKey, MicroSetExport[]>();
        let count = 0;
        let lastReported = 0;
        const total = possibleMeldCombinations.size;
        for (const [key, combination] of possibleMeldCombinations) {
            if (count - lastReported >= 10_000) {
                statusCallback({
                    phase: 3,
                    count: total,
                    subPhase: {
                        phase: count,
                        phaseMax: total,
                    },
                });
                lastReported = count;
            }
            count++;


            const foods = [gearset.food];
            // Solve for food if we have no food enabled, or if overwrite is ticked
            if (!foods[0] || settings.overwriteFood) {
                let foodItems: FoodItem[];
                if (settings.allowedFoodIds) {
                    // If the user has explicitly restricted the food search space, use that.
                    // This bypasses the builtin filtering logic (relevantFoodForSolver).
                    const allowedIds = new Set(settings.allowedFoodIds);
                    foodItems = [...this._sheet.allFoodItems, ...this._sheet.customFood].filter(f => allowedIds.has(f.id));
                }
                else {
                    foodItems = this._sheet.relevantFoodForSolver;
                }
                for (let i = 0; i < foodItems.length; i++) {
                    if (foodItems[i] !== gearset.food) {
                        const food = foodItems[i];
                        foods.push(food);
                    }
                }
            }

            console.log(`Foods available to solver (${foods.length}): ${foods.map(f => `${f.name} (${f.id})`).join(", ")}`);

            for (const food of foods) {
                const newGearset: CharacterGearSet = new CharacterGearSet(this._sheet);
                newGearset.food = food;
                newGearset.equipment = combination.set;

                for (const slotKey of EquipSlots) {
                    if (gearset.equipment[slotKey]?.gearItem?.isCustomRelic) {
                        newGearset.equipment[slotKey].relicStats = gearset.equipment[slotKey].relicStats ?? undefined;
                    }
                }

                newGearset.forceRecalc();
                const gcd = useSks ? newGearset.computedStats.gcdPhys(NORMAL_GCD, haste)
                    : newGearset.computedStats.gcdMag(NORMAL_GCD, haste);

                if (settings.useTargetGcd && gcd !== settings.targetGcd) {
                    continue;
                }

                const stats = newGearset.computedStats;
                const cacheKey = getRotationCacheKey(stats);
                const existing = gcdMap.get(cacheKey);
                if (existing !== undefined) {
                    existing.push(setToMicroExport(newGearset));
                }
                else {
                    gcdMap.set(cacheKey, [setToMicroExport(newGearset)]);
                }
                possibleMeldCombinations.delete(key);
            }
        }

        const gcdMapSize = gcdMap.size;
        statusCallback({
            phase: 4,
            count: count,
            subPhase: {
                phase: 0,
                phaseMax: gcdMapSize,
            },
        });

        console.log("Meld generation: Phase 4 (send combinations back)");
        let gcdMapDone = 0;
        // Push them in rough order of GCD so that rotation caching works well
        for (const [key, sets] of gcdMap) {
            genCallback(sets);
            sets.length = 0;
            gcdMap.delete(key);
            gcdMapDone++;
            statusCallback({
                phase: 4,
                count: count,
                subPhase: {
                    phase: gcdMapDone,
                    phaseMax: gcdMapSize,
                },
            });
        }
    }

    /**
     * Given an item, find all possible combinations of materia, minus those that have exactly the same resulting stats
     * as another combination.
     * @param equippedItem
     */
    public getAllMeldCombinationsForGearItem(equippedItem: EquippedItem): ItemWithStats[] {

        const basePiece = new ItemWithStats(this.cloneEquippedItem(equippedItem), this.getPieceEffectiveStats(equippedItem));

        const meldCombinations: Map<AllStatDedupKey, ItemWithStats> = new Map<AllStatDedupKey, ItemWithStats>();
        // Pre-seed this with the base item stats
        meldCombinations.set(this.statsToKey(equippedItem.gearItem.stats), basePiece);

        for (let slotNum = 0; slotNum < equippedItem.gearItem.materiaSlots.length; slotNum += 1) {

            // Skip a slot if it is either explicitly locked, or it has something in it already (which would imply that
            // the user did not wish to overwrite existing materia)
            const slot = equippedItem.melds[slotNum];
            if (slot.locked || slot.equippedMateria !== null && slot.equippedMateria !== undefined) {
                continue;
            }

            // Add new items after the loop
            const itemsToAdd: Map<AllStatDedupKey, ItemWithStats> = new Map<AllStatDedupKey, ItemWithStats>();
            for (const [statsKey, existingCombination] of meldCombinations) {

                const stats = existingCombination.stats;

                for (const stat of this.relevantStats) {

                    // Use best materia for the slot, e.g. ignore possibility of a materia XI if the slot supports XII
                    const materia = this._sheet.getBestMateria(stat, existingCombination.item.melds[slotNum]);

                    // Copy stats
                    const newStats: RawStats = {...stats};
                    // Old amount
                    const oldStatAmount = newStats[stat];
                    // New amount == old amount plus newly-added materia, or the stat cap, whichever is lesser
                    const newStatAmount = Math.min(oldStatAmount + materia.primaryStatValue, existingCombination.item.gearItem.statCaps[stat] ?? 999_999);
                    newStats[stat] = newStatAmount;
                    // e.g. if my materia is 54, and I go from 100 to 154, no overcap.
                    // But if my materia is 54, and I go from 100 to 152, we lost 2 to overcap.
                    // 2 == 54 - (152 - 100)
                    const lostToOvercap = Math.max(0, materia.primaryStatValue - (newStatAmount - oldStatAmount));
                    const newStatsKey = this.statsToKey(newStats);

                    // Ignore anything that will cause large amounts of overcap, any skip any non-unique stat totals
                    if (lostToOvercap <= MATERIA_ACCEPTABLE_OVERCAP_LOSS && !itemsToAdd.has(newStatsKey)) {
                        const newMelds: MeldableMateriaSlot[] = this.cloneMelds(existingCombination.item.melds);
                        newMelds[slotNum].equippedMateria = materia;
                        itemsToAdd.set(newStatsKey, new ItemWithStats(new EquippedItem(equippedItem.gearItem, newMelds), newStats));
                    }
                }

                meldCombinations.delete(statsKey); // Only take fully melded items
            }

            for (const [key, item] of itemsToAdd) {
                meldCombinations.set(key, item);
            }
        }

        return Array.from(meldCombinations.values());
    }

    cloneEquipmentSetWithStats(set: EquipmentSetWithStats): EquipmentSetWithStats {
        // Shallow copy the individual pieces because they don't need to be unique. i.e. We only need one copy of a DET/DET weapon
        return new EquipmentSetWithStats({...set.set}, Object.assign({}, set.stats));
    }

    cloneEquipmentset(set: EquipmentSet): EquipmentSet {
        const result = new EquipmentSet;
        for (const key in set) {
            const equipSlotKey = key as EquipSlotKey;
            if (set[equipSlotKey] === null || set[equipSlotKey] === undefined) {
                continue;
            }
            result[equipSlotKey] = this.cloneEquippedItem(set[equipSlotKey]);
        }

        return result;
    }

    cloneEquippedItem(item: EquippedItem): EquippedItem {
        return new EquippedItem(item.gearItem, this.cloneMelds(item.melds));
    }

    statsToKey(stats: RawStats): AllStatDedupKey {
        let result = "";
        const relevantStats = this.relevantStats;
        for (const statKey of relevantStats) {
            // Use semicolon to avoid potential number formatting localization issues
            result += stats[statKey].toString() + ';';
        }

        return result;
    }

    addStats(target: RawStats, toAdd: RawStats): RawStats {

        for (const stat of this.relevantStats) {
            target[stat] += toAdd[stat];
        }

        return target;
    }

    getPieceEffectiveStats(item: EquippedItem): RawStats {
        const stats = Object.assign({}, item.gearItem.stats);
        for (const meld of item.melds) {
            if (meld.equippedMateria === null || meld.equippedMateria === undefined) {
                continue;
            }
            const stat = meld.equippedMateria.primaryStat;
            stats[stat] = Math.min(item.gearItem.statCaps[stat] ?? 999_999, stats[stat] + meld.equippedMateria.primaryStatValue);
        }

        return stats;
    }

    cloneMelds(melds: MeldableMateriaSlot[]): MeldableMateriaSlot[] {
        const newMelds: MeldableMateriaSlot[] = [];
        for (const meld of melds) {
            newMelds.push(Object.assign({}, meld));
        }

        return newMelds;
    }
}
