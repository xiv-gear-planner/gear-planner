import {
    ALL_SUB_STATS,
    bluWdfromInt,
    EMPTY_STATS,
    FAKE_MAIN_STATS,
    getLevelStats,
    getRaceStats,
    JobName,
    MAIN_STATS,
    MATERIA_ACCEPTABLE_OVERCAP_LOSS,
    MateriaSubstat,
    NORMAL_GCD,
    RaceName,
    SPECIAL_SUB_STATS
} from "@xivgear/xivmath/xivconstants";
import {
    ComputedSetStats,
    EquipmentSet,
    EquippedItem,
    EquipSlotInfo,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    GearItem,
    GearSetIssue,
    GearSetResult,
    Materia,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    NO_SYNC_STATS,
    RawStatKey,
    RawStats,
    RelicStats,
    SetDisplaySettingsExport,
    XivCombatItem
} from "@xivgear/xivmath/geartypes";
import {Inactivitytimer} from "./util/inactivitytimer";
import {addStats, finalizeStats} from "@xivgear/xivmath/xivstats";
import {GearPlanSheet} from "./sheet";
import {isMateriaAllowed} from "./materia/materia_utils";


export function nonEmptyRelicStats(stats: RelicStats | undefined): boolean {
    return (stats && !Object.values(stats).every(val => !val));
}

export class RelicStatMemory {
    private readonly memory: Map<number, RelicStats> = new Map();

    get(item: GearItem): RelicStats | undefined {
        const stats = this.memory.get(item.id);
        if (nonEmptyRelicStats(stats)) {
            return stats;
        }
        else {
            return undefined;
        }
    }

    set(item: GearItem, stats: RelicStats) {
        if (nonEmptyRelicStats(stats)) {
            this.memory.set(item.id, stats);
        }
    }

    export(): RelicStatMemoryExport {
        return Object.fromEntries(this.memory);
    }

    import(relicStatMemory: RelicStatMemoryExport) {
        Object.entries(relicStatMemory).every(([rawKey, stats]) => this.memory.set(parseInt(rawKey), stats));
    }
}

export type RelicStatMemoryExport = {
    [p: number]: RelicStats;
};


// TODO: this is not yet part of exports
export class MateriaMemory {
    // Map from equipment slot to item ID to list of materia IDs.
    // The extra layer is needed here because you might have the same (non-unique) ring equipped in both slots.
    private readonly memory: Map<EquipSlotKey, Map<number, number[]>> = new Map();

    /**
     * Get the remembered materia for an item
     *
     * If there is no mapping, returns an empty list
     *
     * @param equipSlot The equipment slot (needed to differentiate left/right ring)
     * @param item The item in question
     */
    get(equipSlot: EquipSlotKey, item: GearItem): number[] {
        const bySlot = this.memory.get(equipSlot);
        if (!bySlot) {
            return []
        }
        const byItem = bySlot.get(item.id);
        return byItem ?? [];
    }

    /**
     * Provide a new list of materia by providing an equipped item
     *
     * @param equipSlot The slot
     * @param item The item which is about to be unequipped from that slot.
     */
    set(equipSlot: EquipSlotKey, item: EquippedItem) {
        let bySlot: Map<number, number[]>;
        if (this.memory.has(equipSlot)) {
            bySlot = this.memory.get(equipSlot);
        }
        else {
            bySlot = new Map();
            this.memory.set(equipSlot, bySlot);
        }
        bySlot.set(item.gearItem.id, item.melds.map(meld => meld.equippedMateria?.id ?? -1));
    }

    export(): MateriaMemoryExport {
        const out: MateriaMemoryExport = {};
        this.memory.forEach((slotValue, slotKey) => {
            const items: SlotMateriaMemoryExport[] = [];
            slotValue.forEach((materiaIds, itemId) => {
                items.push([itemId, materiaIds]);
            });
            out[slotKey] = items;
        });
        return Object.fromEntries(this.memory) as unknown as MateriaMemoryExport;
    }

    import(memory: MateriaMemoryExport) {
        Object.entries(memory).every(([slotKey, itemMemory]) => {
            const slotMap: Map<number, number[]> = new Map();
            for (const itemMemoryElement of itemMemory) {
                slotMap.set(itemMemoryElement[0], itemMemoryElement[1]);
            }
            this.memory.set(slotKey as EquipSlotKey, slotMap);
        });
    }
}

export type SlotMateriaMemoryExport = [item: number, materiaIds: number[]];

export type MateriaMemoryExport = {
    [slot in EquipSlotKey]?: SlotMateriaMemoryExport[]
};


export class SetDisplaySettings {
    private readonly hiddenSlots: Map<EquipSlotKey, boolean> = new Map();

    isSlotHidden(slot: EquipSlotKey): boolean {
        const hidden = this.hiddenSlots.get(slot);
        return hidden === true;
    }

    setSlotHidden(slot: EquipSlotKey, hidden: boolean) {
        this.hiddenSlots.set(slot, hidden);
    }

    export(): SetDisplaySettingsExport {
        const hiddenSlots: EquipSlotKey[] = [];
        this.hiddenSlots.forEach((value, key) => {
            if (value) {
                hiddenSlots.push(key);
            }
        });
        return {
            hiddenSlots: hiddenSlots,
        }
    }

    import(imported: SetDisplaySettingsExport) {
        imported.hiddenSlots.forEach(slot => this.hiddenSlots.set(slot, true));
    }
}

export function previewItemStatDetail(item: GearItem, stat: RawStatKey): ItemSingleStatDetail {
    const cap = item.statCaps[stat];
    if (item.isSyncedDown) {
        const unsynced = item.unsyncedVersion.stats[stat];
        const synced = item.stats[stat];
        // TODO: I don't really like that 'unsynced' and 'cap' are used kind of interchangeably
        // here, even though they *should* be the same at this point.
        if (synced < unsynced) {
            return {
                effectiveAmount: synced,
                fullAmount: unsynced,
                overcapAmount: unsynced - synced,
                cap: cap,
                mode: "synced-down"
            }
        }
        else {
            return {
                mode: 'unmelded',
                effectiveAmount: synced,
                fullAmount: synced,
                cap: cap,
                overcapAmount: 0
            };
        }
    }
    else {
        // If there is later an ability to make melds sticky, this would be a good place to implement 'previewing' it.
        const statAmount = item.stats[stat];
        return {
            mode: 'unmelded',
            effectiveAmount: statAmount,
            fullAmount: statAmount,
            overcapAmount: 0,
            cap: cap,
        }
    }
}

/**
 * Class representing equipped gear, food, and other overrides.
 */
export class CharacterGearSet {
    private _name: string;
    private _description: string;
    equipment: EquipmentSet;
    listeners: (() => void)[] = [];
    private _dirtyComp: boolean = true;
    private _updateKey: number = 0;
    private _lastResult: GearSetResult;
    private _jobOverride: JobName;
    private _raceOverride: RaceName;
    private _food: FoodItem;
    private readonly _sheet: GearPlanSheet;
    private readonly refresher = new Inactivitytimer(0, () => {
        this._notifyListeners();
    });
    readonly relicStatMemory: RelicStatMemory = new RelicStatMemory();
    readonly materiaMemory: MateriaMemory = new MateriaMemory();
    readonly displaySettings: SetDisplaySettings = new SetDisplaySettings();
    isSeparator: boolean = false;

    constructor(sheet: GearPlanSheet) {
        this._sheet = sheet;
        this.name = "";
        this.equipment = new EquipmentSet();
    }

    get updateKey() {
        return this._updateKey;
    }


    get name() {
        return this._name;
    }

    set name(name) {
        this._name = name;
        this.notifyListeners();
    }

    get description() {
        return this._description;
    }

    set description(desc) {
        this._description = desc;
        this.notifyListeners();
    }


    get food(): FoodItem | undefined {
        return this._food;
    }

    get sheet(): GearPlanSheet {
        return this._sheet;
    }

    private invalidate() {
        this._dirtyComp = true;
        this._updateKey++;
    }

    set food(food: FoodItem | undefined) {
        this.invalidate();
        this._food = food;
        console.log(`Set ${this.name}: food => ${food?.name}`);
        this.notifyListeners();
    }

    setEquip(slot: EquipSlotKey, item: GearItem, materiaAutoFillController?: MateriaAutoFillController) {
        if (this.equipment[slot]?.gearItem === item) {
            return;
        }
        const old = this.equipment[slot];
        if (old) {
            if (old.relicStats) {
                this.relicStatMemory.set(old.gearItem, old.relicStats);
            }
            if (old.melds.length > 0) {
                this.materiaMemory.set(slot, old);
            }
        }
        this.invalidate();
        this.equipment[slot] = this.toEquippedItem(item);
        console.log(`Set ${this.name}: slot ${slot} => ${item?.name}`);
        if (materiaAutoFillController) {
            const mode = materiaAutoFillController.autoFillMode;
            if (mode === 'leave_empty') {
                // Do nothing
            }
            else {
                // This var tracks what we would like to re-equip
                let reEquip: Materia[] = [];
                if (mode === 'retain_slot' || mode === 'retain_slot_else_prio') {
                    if (old && old.melds.find(meld => meld.equippedMateria)) {
                        reEquip = old.melds.map(meld => meld.equippedMateria).filter(value => value);
                    }
                }
                else if (mode === 'retain_item' || mode === 'retain_item_else_prio') {
                    const materiaIds = this.materiaMemory.get(slot, item);
                    materiaIds.forEach((materiaId, index) => {
                        const meld = this.equipment[slot].melds[index];
                        if (meld) {
                            reEquip.push(this._sheet.getMateriaById(materiaId));
                        }
                    });
                }
                if (mode === 'autofill'
                    || (reEquip.length === 0
                        && (mode === 'retain_item_else_prio' || mode === 'retain_slot_else_prio'))) {
                    this.fillMateria(materiaAutoFillController.prio, false, [slot]);
                }
                else {
                    const eq = this.equipment[slot];
                    for (let i = 0; i < reEquip.length; i++) {
                        if (i in eq.melds) {
                            const meld = eq.melds[i];
                            const materia = reEquip[i];
                            if (isMateriaAllowed(materia, meld.materiaSlot)) {
                                meld.equippedMateria = reEquip[i];
                            }
                        }
                    }

                }
            }
        }
        this.notifyListeners()
    }

    /**
     * Preview an item as if it were equipped
     *
     * @param item The item with relic stat memory and such applied
     */
    toEquippedItem(item: GearItem) {
        if (item === null) {
            return null;
        }
        const equipped = new EquippedItem(item);
        if (item.isCustomRelic) {
            const oldStats = this.relicStatMemory.get(item);
            if (oldStats) {
                equipped.relicStats = oldStats;
            }
        }
        return equipped;
    }

    private notifyListeners() {
        // TODO: a little janky. This is to work around an issue where by updating properties after importing, we
        // get an extra refresh request. Simple hack is to just refuse to issue any requests until we have at least
        // one listener.
        if (this.listeners.length > 0) {
            this.refresher.ping();
        }
    }

    private _notifyListeners() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    forceRecalc() {
        this.invalidate();
        this.notifyListeners();
    }

    addListener(listener: () => void) {
        this.listeners.push(listener);
    }

    getItemInSlot(slot: keyof EquipmentSet): GearItem | null {
        const inSlot = this.equipment[slot];
        if (inSlot === null || inSlot === undefined) {
            return null;
        }

        return inSlot.gearItem;
    }

    get allEquippedItems(): XivCombatItem[] {
        return Object.values(this.equipment)
            .filter(slotEquipment => slotEquipment && slotEquipment.gearItem)
            .map((slotEquipment: EquippedItem) => slotEquipment.gearItem);
    }

    get issues(): readonly GearSetIssue[] {
        return this.results.issues;
    }

    get computedStats(): ComputedSetStats {
        return this.results.computedStats;
    }

    get results(): GearSetResult {
        const issues: GearSetIssue[] = [];
        if (!this._dirtyComp) {
            return this._lastResult;
        }
        const combinedStats = new RawStats(EMPTY_STATS);
        const classJob = this._jobOverride ?? this._sheet.classJobName;
        const classJobStats = this._jobOverride ? this._sheet.statsForJob(this._jobOverride) : this._sheet.classJobStats;
        const raceStats = this._raceOverride ? getRaceStats(this._raceOverride) : this._sheet.raceStats;
        const level = this._sheet.level;
        const levelStats = getLevelStats(level);

        // Item stats
        for (const key of EquipSlots) {
            if (this.equipment[key]) {
                const slotEffectiveStatsFull = this.getSlotEffectiveStatsFull(key);
                addStats(combinedStats, slotEffectiveStatsFull.stats);
                issues.push(...slotEffectiveStatsFull.issues);
            }
        }

        // Intelligence stat from gear only (no modifiers) for BLU
        const gearIntStat = combinedStats.intelligence;

        // Base stats based on job and level
        for (const statKey of MAIN_STATS) {
            combinedStats[statKey] += Math.floor(levelStats.baseMainStat * classJobStats.jobStatMultipliers[statKey] / 100);
        }
        for (const statKey of FAKE_MAIN_STATS) {
            combinedStats[statKey] += Math.floor(levelStats.baseMainStat);
        }
        for (const statKey of SPECIAL_SUB_STATS) {
            combinedStats[statKey] += Math.floor(levelStats.baseSubStat);
        }

        // Add race stats
        addStats(combinedStats, raceStats);

        this._dirtyComp = false;
        // Add BLU weapon damage modifier
        combinedStats.wdMag += classJob === "BLU" ? bluWdfromInt(gearIntStat) : 0;
        const computedStats = finalizeStats(combinedStats, this._food?.bonuses ?? {}, level, levelStats, classJob, classJobStats, this._sheet.partyBonus);
        const leftRing = this.getItemInSlot('RingLeft');
        const rightRing = this.getItemInSlot('RingRight');
        if (leftRing && leftRing.isUnique && rightRing && rightRing.isUnique) {
            if (leftRing.id === rightRing.id) {
                issues.push({
                    severity: 'error',
                    description: `You cannot equip ${leftRing.name} in both ring slots because it is a unique item.`
                });
            }
        }
        const weapon = this.getItemInSlot('Weapon');
        if (!weapon) {
            issues.push({
                severity: 'error',
                description: 'You must equip a weapon'
            });
        }
        this._lastResult = {
            computedStats: computedStats,
            issues: this.isSeparator ? [] : issues
        };
        console.info("Recomputed stats", this._lastResult);
        return this._lastResult;
    }

    getSlotEffectiveStatsFull(slotId: EquipSlotKey): {
        stats: RawStats,
        issues: GearSetIssue[]
    } {
        const issues: GearSetIssue[] = [];
        const equip = this.equipment[slotId];
        if (!equip.gearItem) {
            return {
                stats: EMPTY_STATS,
                issues: []
            };
        }
        const itemStats = new RawStats(equip.gearItem.stats);
        // Note for future: if we ever get an item that has both custom stats AND materia, this logic will need to be extended.
        for (const stat of ALL_SUB_STATS) {
            const statDetail = this.getStatDetail(slotId, stat);
            itemStats[stat] = statDetail.effectiveAmount;
            if (statDetail.mode === 'melded-overcapped-major') {
                issues.push({
                    severity: "warning",
                    description: `${EquipSlotInfo[slotId].name} is overcapped, losing ${statDetail.overcapAmount} ${stat}.`,
                    affectedSlots: [slotId]
                });
            }
        }
        if (equip.gearItem.isCustomRelic) {
            const failures = equip.gearItem.relicStatModel.validate(equip);
            for (const failure of failures) {
                issues.push({
                    ...failure,
                    affectedSlots: [slotId]
                });

            }
        }
        return {
            stats: itemStats,
            issues: issues
        };
    }


    getSlotEffectiveStats(slotId: EquipSlotKey): RawStats {
        return this.getSlotEffectiveStatsFull(slotId).stats;
    }

    getStatDetail(slotId: keyof EquipmentSet, stat: RawStatKey, materiaOverride?: Materia[]): ReturnType<typeof this.getEquipStatDetail> {
        const equip = this.equipment[slotId];
        return this.getEquipStatDetail(equip, stat, materiaOverride);
    }

    getEquipStatDetail(equip: EquippedItem, stat: RawStatKey, materiaOverride?: Materia[]): ItemSingleStatDetail {
        const gearItem = equip.gearItem;
        if (!gearItem) {
            return {
                mode: 'unequipped',
                overcapAmount: 0,
                effectiveAmount: 0,
                fullAmount: 0,
                cap: 0
            };
        }
        const stats = new RawStats(gearItem.stats);
        if (equip.relicStats) {
            const relicStats = new RawStats(equip.relicStats);
            addStats(stats, relicStats);
        }
        if (gearItem.isSyncedDown) {
            if (gearItem.isCustomRelic) {
                const cap = gearItem.statCaps[stat];
                const current = stats[stat];
                if (cap && current > cap) {
                    return {
                        effectiveAmount: cap,
                        fullAmount: current,
                        overcapAmount: current - cap,
                        cap: cap,
                        mode: "synced-down"
                    }
                }
                else {
                    return {
                        effectiveAmount: current,
                        fullAmount: current,
                        overcapAmount: 0,
                        cap: cap,
                        mode: 'unmelded'
                    }
                }
            }
            else {
                const unsynced = gearItem.unsyncedVersion.stats[stat];
                const synced = stats[stat];
                if (synced < unsynced) {
                    return {
                        effectiveAmount: synced,
                        fullAmount: unsynced,
                        overcapAmount: unsynced - synced,
                        cap: synced,
                        mode: "synced-down"
                    }
                }
                else {
                    return {
                        effectiveAmount: synced,
                        fullAmount: synced,
                        overcapAmount: 0,
                        cap: synced,
                        mode: 'unmelded'
                    }
                }
            }
        }
        const cap = gearItem.statCaps[stat] ?? 9999;
        const baseItemStatValue = stats[stat];
        let meldedStatValue = baseItemStatValue;
        let smallestMateria = 999999;
        const materiaList = materiaOverride === undefined ? equip.melds.map(meld => meld.equippedMateria).filter(item => item) : materiaOverride.filter(item => item);
        for (const materia of materiaList) {
            const materiaStatValue = materia.stats[stat];
            if (materiaStatValue > 0) {
                meldedStatValue += materiaStatValue;
                smallestMateria = Math.min(smallestMateria, materiaStatValue);
            }
        }
        // Not melded or melds are not relevant to this stat
        if (meldedStatValue === baseItemStatValue) {
            return {
                mode: 'unmelded',
                overcapAmount: 0,
                effectiveAmount: meldedStatValue,
                fullAmount: meldedStatValue,
                cap: meldedStatValue
            }
        }
        // Overcapped
        const overcapAmount = meldedStatValue - cap;
        if (overcapAmount <= 0) {
            return {
                effectiveAmount: meldedStatValue,
                fullAmount: meldedStatValue,
                overcapAmount: 0,
                cap: cap,
                mode: "melded",
            }
        }
        else if (overcapAmount < smallestMateria) {
            return {
                effectiveAmount: cap,
                fullAmount: meldedStatValue,
                overcapAmount: overcapAmount,
                cap: cap,
                mode: "melded-overcapped",
            }
        }
        else {
            return {
                effectiveAmount: cap,
                fullAmount: meldedStatValue,
                overcapAmount: overcapAmount,
                cap: cap,
                mode: "melded-overcapped-major",
            }
        }
    }

    /**
     * Perform a materia auto-fill.
     *
     * @param prio The priority of stats.
     * @param overwrite true to fill all slots, even if already occupied. false to only fill empty slots.
     * @param slots Omit to fill all slots. Specify one or more slots to specifically fill those slots.
     */
    fillMateria(prio: MateriaAutoFillPrio, overwrite: boolean, slots?: EquipSlotKey[]) {
        const statPrio: MateriaSubstat[] = prio.statPrio;
        // If overwriting, first delete everything. We have to pre-delete everything so that the GCD-specific
        // logic won't remove SpS/SkS melds in materia on the first few items because it thinks we're good on speed
        // (since the materia are already there).
        if (overwrite) {
            for (const slotKey of (slots === undefined ? EquipSlots : slots)) {
                const equipSlot = this.equipment[slotKey] as EquippedItem | null;
                const gearItem = equipSlot?.gearItem;
                if (gearItem) {
                    equipSlot.melds.forEach(meldSlot => meldSlot.equippedMateria = null);
                }
            }
            this.forceRecalc();
        }
        for (const slotKey of (slots === undefined ? EquipSlots : slots)) {
            const equipSlot = this.equipment[slotKey] as EquippedItem | null;
            const gearItem = equipSlot?.gearItem;
            if (gearItem) {
                materiaLoop: for (const meldSlot of equipSlot.melds) {
                    // If overwriting, we already cleared the slots, so this check is fine in any scenario.
                    if (meldSlot.equippedMateria) {
                        continue;
                    }
                    const slotStats = this.getSlotEffectiveStats(slotKey);
                    // TODO: we also have gearItem.substatCap we can use to make it more direct
                    const override = this.sheet.classJobStats.gcdDisplayOverrides?.(this.sheet.level) ?? [];
                    for (const stat of statPrio) {
                        if (stat === 'skillspeed') {
                            const over = override.find(over => over.basis === 'sks' && over.isPrimary);
                            const attackType = over ? over.attackType : 'Weaponskill';
                            const haste = this.computedStats.haste(attackType) + (over ? over.haste : 0);
                            if (this.computedStats.gcdPhys(NORMAL_GCD, haste) <= prio.minGcd) {
                                continue;
                            }
                            this.forceRecalc();
                            if (this.computedStats.gcdPhys(NORMAL_GCD, haste) <= prio.minGcd) {
                                continue;
                            }
                        }
                        if (stat === 'spellspeed') {
                            const over = override.find(over => over.basis === 'sps' && over.isPrimary);
                            const attackType = over ? over.attackType : 'Spell';
                            const haste = this.computedStats.haste(attackType) + (over ? over.haste : 0);
                            // Check if we're already there before forcing a recomp
                            if (this.computedStats.gcdMag(NORMAL_GCD, haste) <= prio.minGcd) {
                                continue;
                            }
                            this.forceRecalc();
                            if (this.computedStats.gcdMag(NORMAL_GCD, haste) <= prio.minGcd) {
                                continue;
                            }
                        }
                        const newMateria: Materia = this._sheet.getBestMateria(stat, meldSlot);
                        if (!newMateria) {
                            continue;
                        }
                        // TODO make this a setting?
                        // console.log(`Materia Fill: ${stat} ${newMateria.primaryStatValue} ${slotStats[stat]} ${cap}`);
                        // Allow for losing 1 or 2 stat points
                        const cap = gearItem.statCaps[stat] ?? (() => {
                            console.error(`Failed to calculate substat cap for ${stat} on ${gearItem.id} (${gearItem.id})`);
                            return 1000;
                        })();
                        if (newMateria.primaryStatValue + slotStats[stat] - MATERIA_ACCEPTABLE_OVERCAP_LOSS < cap) {
                            meldSlot.equippedMateria = newMateria;
                            continue materiaLoop;
                        }
                    }
                }
            }
        }
        this.forceRecalc();
    }

    isStatRelevant(stat: RawStatKey) {
        return this._sheet.isStatRelevant(stat);
    }

    private collapsed: boolean;

    isSlotCollapsed(slotId: EquipSlotKey) {
        return this.displaySettings.isSlotHidden(slotId);
    }

    setSlotCollapsed(slotId: EquipSlotKey, val: boolean) {
        this.displaySettings.setSlotHidden(slotId, val);
    }
}

export function applyStatCaps(stats: RawStats, statCaps: { [K in RawStatKey]?: number }) {
    const out = {
        ...stats
    };
    Object.entries(stats).forEach(([stat, value]) => {
        if (NO_SYNC_STATS.includes(stat as RawStatKey)) {
            return;
        }
        out[stat] = Math.min(value, statCaps[stat] ?? 999999);
    });
    return out;
}

/**
 * Represents a single stat of an item (possibly equipped) or item slot.
 *
 * 'mode' is a general description of what is going on with the item/slot.
 * 'unmelded' and 'synced-down' are self-explanatory.
 * 'melded' means it is melded and is not overcapped at all.
 * 'melded-overcapped' means that you're wasting a small amount of stats. See xivconstants' MATERIA_ACCEPTABLE_OVERCAP_LOSS.
 * 'melded-overcapped-major' means that you're wasting a larger amount of stats via overcapped melds.
 * 'unequipped' is only applicable when examining a slot rather than specific item. It means there is nothing equipped in that slot.
 *
 * 'effectiveAmount' is the amount of the stat actually being provided.
 * 'fullAmount' is the amount that would be provided if not capped.
 * 'overcapAmount' is how much is being lost by syncing down or overcapping materia.
 * 'cap' is the cap.
 */
export type ItemSingleStatDetail = {
    // TODO: see if there's a way to enforce that effectiveAmount == fullAMount == cap for this branch
    mode: 'unmelded' | 'melded',
    overcapAmount: 0,
    effectiveAmount: number,
    fullAmount: number,
    cap: number,
} | {
    mode: 'melded-overcapped' | 'melded-overcapped-major' | 'synced-down',
    overcapAmount: number,
    effectiveAmount: number,
    fullAmount: number,
    cap: number,
} | {
    mode: 'unequipped',
    overcapAmount: 0,
    effectiveAmount: 0,
    fullAmount: 0,
    cap: 0,
};


