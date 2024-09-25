import { CharacterGearSet } from "@xivgear/core/gear";
import { EquippedItem, RawStats, EquipmentSet, EquipSlots, MeldableMateriaSlot } from "@xivgear/xivmath/geartypes";
import { MateriaSubstat, ALL_SUB_STATS, MATERIA_ACCEPTABLE_OVERCAP_LOSS, NORMAL_GCD } from "@xivgear/xivmath/xivconstants";
import { SimResult, SimSettings, Simulation } from "@xivgear/core/sims/sim_types";
import { MeldSolverSettings } from "./meld_solver_bar";
import { sksToGcd, spsToGcd } from "@xivgear/xivmath/xivmath";
import { GearPlanSheet } from "@xivgear/core/sheet";

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

export class MeldSolver {

    readonly _sheet: GearPlanSheet;
    readonly _settings: MeldSolverSettings;

    relevantStats: MateriaSubstat[]; //= ALL_SUB_STATS.filter(stat => this._sheet.isStatRelevant(stat) && stat != 'piety');

    public constructor(sheet: GearPlanSheet, settings: MeldSolverSettings) {
        this._sheet = sheet;
        this._settings = settings;
        this.relevantStats = ALL_SUB_STATS.filter(stat => this._sheet.isStatRelevant(stat) && stat != 'piety');
    }

    public async solveMelds() : Promise<CharacterGearSet> {
        
        if (!this._settings.sim) {
            return null;
        }

        let generatedSets = this.getAllMeldCombinations(
            this._settings.gearset,
            this._settings.overwriteExistingMateria,
            this._settings.useTargetGcd ? this._settings.targetGcd : null);

        if (generatedSets.size == 0) {
            return null;
        }

        const bestSet = await this.simulateSets(
            generatedSets,
            this._settings.sim
        );

        return bestSet;
    }

    async simulateSets(setsToSim: Set<CharacterGearSet>, sim: Simulation<SimResult, SimSettings, any>)
    : Promise<CharacterGearSet> {

        if (setsToSim.size == 0) {
            return null;
        }

        let bestSimDps: number = 0;
        let bestSet: CharacterGearSet;

        let numSetsProcessed = 0;
        let lastUpdate = 0;
        let progressResolution = 0.05
        let threshold = setsToSim.size * progressResolution;

        /**
         * Very important: order sets by sks to avoid generating rotations with every new set
         */
        const sortedSetsBySpeed = Array.from(setsToSim).sort((setA, setB) => {
            let useSks = 'skillspeed' in this.relevantStats;
            return useSks ?
                setA.computedStats.skillspeed - setB.computedStats.skillspeed
                : setA.computedStats.spellspeed - setB.computedStats.spellspeed
        })
        
        postMessage(0);
        for (const set of sortedSetsBySpeed) {
            const result = await sim.simulate(set);
            if (result.mainDpsResult > bestSimDps) {
                bestSimDps = result.mainDpsResult;
                bestSet = set;
            }

            numSetsProcessed++;

            if (numSetsProcessed - lastUpdate >= threshold) {
                postMessage(Math.floor(100 * (numSetsProcessed / setsToSim.size)));
            }
        }

        return bestSet;
    }

    getAllMeldCombinations(gearset: CharacterGearSet, overwriteMateria: boolean, targetGcd?: number): Set<CharacterGearSet> {

        const levelStats = gearset.computedStats.levelStats;
        const override = this._sheet.classJobStats.gcdDisplayOverrides?.(this._sheet.level) ?? [];
        const useSks = gearset.isStatRelevant('skillspeed');
        const over = override.find(over => over.basis === (useSks ? 'sks' : 'sps'));
        const attackType = over ? over.attackType : useSks ? 'Weaponskill' : 'Spell';
        const haste = gearset.computedStats.haste(attackType) + (over ? over.haste : 0);

        const equipment = this.cloneEquipmentset(gearset.equipment);
        
        if (overwriteMateria) {
            for (const slotKey of EquipSlots) {
                const equipSlot = equipment[slotKey] as EquippedItem | null;
                const gearItem = equipSlot?.gearItem;
                if (gearItem) {
                    equipSlot.melds.forEach(meldSlot => meldSlot.equippedMateria = null);
                }
            }
        }

        const generatedGearsets = new Set<CharacterGearSet>
        let possibleMeldCombinations = new Map<string, EquipmentSetWithStats>();
        const baseEquipSet = new EquipmentSetWithStats(new EquipmentSet, new RawStats);

        // Generate these first to avoid re-doing them. Also saves memory by letting our EquipmentSets shallow copy EquippedItems which all reside in here.
        const allIndividualGearPieces: Map<string, Set<ItemWithStats>> = new Map<string, Set<ItemWithStats>>();
        for (const slotKey of EquipSlots) {
            if (equipment[slotKey] === null || equipment[slotKey] === undefined) continue;

            const pieceCombinations = this.getAllMeldCombinationsForGearItem(equipment[slotKey]);
            allIndividualGearPieces.set(slotKey, pieceCombinations);
        }

        possibleMeldCombinations.set(this.statsToString(baseEquipSet.stats, this.relevantStats), baseEquipSet);

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
        for (const slotKey of EquipSlots) {

            if (equipment[slotKey] === null || equipment[slotKey] === undefined) continue;

            const newGearsets = new Map<string, EquipmentSetWithStats>();
            for (const currSet of possibleMeldCombinations.values()) {

                for (const currPiece of allIndividualGearPieces.get(slotKey).values()) {

                    const setStatsWithPiece = this.addStats(Object.assign({}, currSet.stats), currPiece.stats);
                    const setPlusNewPieceKey = this.statsToString(setStatsWithPiece, this.relevantStats);

                    const gcd = useSks ? sksToGcd(NORMAL_GCD, levelStats, setStatsWithPiece['skillspeed'], haste)
                                        : spsToGcd(NORMAL_GCD, levelStats, setStatsWithPiece['spellspeed'], haste);

                    // Exclude anything that is already past our target GCD, because there's no anti-sks that will slow the set down to target
                    if (!newGearsets.has(setPlusNewPieceKey)
                        && (!targetGcd || gcd > targetGcd)) { 

                        const setPlusNewPiece = this.cloneEquipmentSetWithStats(currSet);
                        setPlusNewPiece.set[slotKey] = currPiece.item;
                        setPlusNewPiece.stats = setStatsWithPiece;

                        newGearsets.set(setPlusNewPieceKey, setPlusNewPiece);
                    }
                }
            }

            possibleMeldCombinations = newGearsets;
        }

        for (const combination of possibleMeldCombinations.values()) {

            const newGearset: CharacterGearSet = new CharacterGearSet(this._sheet);
            newGearset.food = gearset.food;
            newGearset.equipment = combination.set;
            
            newGearset.forceRecalc();
            let gcd = useSks ? newGearset.computedStats.gcdPhys(NORMAL_GCD, haste)
                                : newGearset.computedStats.gcdMag(NORMAL_GCD, haste);
            
            if (!targetGcd || gcd === targetGcd) {
                generatedGearsets.add(newGearset);
            }
        }

        return generatedGearsets;
    }

    public getAllMeldCombinationsForGearItem(equippedItem: EquippedItem): Set<ItemWithStats> | null {
        const meldCombinations: Map<string, ItemWithStats> = new Map<string, ItemWithStats>();

        const basePiece = new ItemWithStats(this.cloneEquippedItem(equippedItem), this.getPieceEffectiveStats(equippedItem));
        meldCombinations.set(this.statsToString(equippedItem.gearItem.stats, this.relevantStats), basePiece);

        for (let slotNum = 0; slotNum < equippedItem.gearItem.materiaSlots.length; slotNum += 1) {

            // We are presuming that any pre-existing materia is locked. Skip this slot and continue from next.
            if (equippedItem.melds[slotNum].equippedMateria !== null && equippedItem.melds[slotNum].equippedMateria !== undefined) {
                continue;
            }

            // Add new items after the loop
            const itemsToAdd: Map<string, ItemWithStats> = new Map<string, ItemWithStats>(); 
            for (const [statsKey, existingCombination] of meldCombinations) {

                const stats = existingCombination.stats;

                for (const stat of this.relevantStats) {

                    const materia = this._sheet.getBestMateria(stat, existingCombination.item.melds[slotNum]);

                    const newStats: RawStats = Object.assign({}, stats);
                    newStats[stat] += materia.primaryStatValue;
                    const newStatsKey = this.statsToString(newStats, this.relevantStats);


                    if (stats[stat] + materia.primaryStatValue - existingCombination.item.gearItem.statCaps[stat] < MATERIA_ACCEPTABLE_OVERCAP_LOSS
                        && !itemsToAdd.has(newStatsKey) // Skip if this combination of stats has been found
                    ) {
                        const newMelds: MeldableMateriaSlot[] = this.cloneMelds(existingCombination.item.melds);
                        newMelds[slotNum].equippedMateria = materia;

                        itemsToAdd.set(newStatsKey, new ItemWithStats(new EquippedItem(equippedItem.gearItem, newMelds), newStats));
                    }
                }

                meldCombinations.delete(statsKey); // Only take fully melded items
            }

            for (const item of itemsToAdd) {
                meldCombinations.set(item[0], item[1]);
            }

        }
        
        return new Set(meldCombinations.values());
    }

    cloneEquipmentSetWithStats(set: EquipmentSetWithStats): EquipmentSetWithStats {
        // Shallow copy the individual pieces because they don't need to be unique. i.e. We only need one copy of a DET/DET weapon
        return new EquipmentSetWithStats(Object.assign({}, set.set), Object.assign({}, set.stats));
    }

    cloneEquipmentset(set: EquipmentSet): EquipmentSet {
        const result = new EquipmentSet;
        for(const equipSlotKey in set) {
            if (set[equipSlotKey] === null || set[equipSlotKey] === undefined) continue;
            result[equipSlotKey] = this.cloneEquippedItem(set[equipSlotKey]);
        }

        return result;
    }

    cloneEquippedItem(item: EquippedItem): EquippedItem {
        return new EquippedItem(item.gearItem, this.cloneMelds(item.melds));
    }

    statsToString(stats: RawStats, relevantStats: MateriaSubstat[]): string {
        let result = "";
        for (const statKey of relevantStats) {
            result += stats[statKey].toString() + ',';
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
            if (meld.equippedMateria === null || meld.equippedMateria === undefined) continue;
            stats[meld.equippedMateria.primaryStat] += meld.equippedMateria.primaryStatValue;
        }

        return stats;
    }

    getEquipmentSetEffectiveStats(set: EquipmentSet): RawStats {

        let stats = new RawStats;
        for (const piece in set) {
            if (set[piece] === null || set[piece] === undefined) continue;
            stats = this.addStats(stats, this.getPieceEffectiveStats(set[piece]));
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