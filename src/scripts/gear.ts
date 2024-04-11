import {
    ALL_SUB_STATS,
    ARTIFACT_ITEM_LEVELS,
    BASIC_TOME_GEAR_ILVLS,
    EMPTY_STATS,
    FAKE_MAIN_STATS,
    getLevelStats,
    getRaceStats,
    JobName,
    MAIN_STATS,
    MATERIA_ACCEPTABLE_OVERCAP_LOSS,
    MATERIA_LEVEL_MAX_NORMAL,
    MATERIA_LEVEL_MAX_OVERMELD,
    MATERIA_LEVEL_MIN_RELEVANT,
    MATERIA_SLOTS_MAX,
    MateriaSubstat,
    NORMAL_GCD,
    RaceName,
    RAID_TIER_ILVLS,
    SPECIAL_SUB_STATS,
    statById,
    bluWdfromInt
} from "./xivconstants";
import {
    autoAttackModifier,
    autoDhBonusDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg,
    mainStatMulti,
    mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    tenacityDmg,
    vitToHp,
    wdMulti
} from "./xivmath";
import {
    ComputedSetStats,
    DisplayGearSlot,
    DisplayGearSlotInfo,
    DisplayGearSlotKey,
    EquipmentSet,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    GearAcquisitionSource,
    GearItem,
    Materia,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    MateriaSlot,
    MeldableMateriaSlot,
    NO_SYNC_STATS,
    OccGearSlotKey,
    RawStatKey,
    RawStats,
    StatBonus,
    Substat,
    XivCombatItem
} from "./geartypes";
import {GearPlanSheet} from "./components";
import {xivApiIcon} from "./external/xivapi";
import {IlvlSyncInfo} from "./datamanager";
import {XivApiStat, xivApiStatMapping} from "./external/xivapitypes";
import {Inactivitytimer} from "./util/inactivitytimer";
import {RelicStatModel} from "./relicstats/relicstats";


export type RelicStats = {
    [K in Substat]?: number
}

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

export class EquippedItem {

    gearItem: GearItem;
    melds: MeldableMateriaSlot[];
    relicStats?: RelicStats;

    constructor(gearItem: GearItem, melds: MeldableMateriaSlot[] | undefined = undefined) {
        this.gearItem = gearItem;
        if (melds === undefined) {
            this.melds = [];
            for (let materiaSlot of gearItem.materiaSlots) {
                this.melds.push({
                    materiaSlot: materiaSlot,
                    equippedMateria: null
                })
            }
        }
        else {
            this.melds = [...melds];
        }
        if (gearItem.isCustomRelic) {
            this.relicStats = {};
        }
    }
}

export type GearSetIssue = {
    readonly severity: 'warning' | 'error',
    readonly description: string
}

export type GearSetResult = {
    readonly computedStats: ComputedSetStats,
    readonly issues: readonly GearSetIssue[]
}

export type SetDisplaySettingsExport = {
    hiddenSlots: EquipSlotKey[]
}

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
        })
        return {
            hiddenSlots: hiddenSlots,
        }
    }

    import(imported: SetDisplaySettingsExport) {
        imported.hiddenSlots.forEach(slot => this.hiddenSlots.set(slot, true));
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
    private _sheet: GearPlanSheet;
    private readonly refresher = new Inactivitytimer(0, () => {
        this._notifyListeners();
    });
    readonly relicStatMemory: RelicStatMemory = new RelicStatMemory();
    readonly displaySettings: SetDisplaySettings = new SetDisplaySettings();

    constructor(sheet: GearPlanSheet) {
        this._sheet = sheet;
        this.name = ""
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

    setEquip(slot: EquipSlotKey, item: GearItem, materiaAutoFill?: MateriaAutoFillController) {
        // TODO: this is also a good place to implement temporary persistent materia/relic stats
        if (this.equipment[slot]?.gearItem === item) {
            return;
        }
        const old = this.equipment[slot];
        if (old && old.relicStats) {
            this.relicStatMemory.set(old.gearItem, old.relicStats);
        }
        this.invalidate();
        this.equipment[slot] = this.toEquippedItem(item);
        console.log(`Set ${this.name}: slot ${slot} => ${item.name}`);
        if (materiaAutoFill && materiaAutoFill.autoFillNewItem) {
            this.fillMateria(materiaAutoFill.prio, false, [slot]);
        }
        this.notifyListeners()
    }

    /**
     * Preview an item as if it were equipped
     *
     * @param item The item with relic stat memory and such applied
     */
    toEquippedItem(item: GearItem) {
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
        for (let listener of this.listeners) {
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
        for (let key of EquipSlots) {
            if (this.equipment[key]) {
                addStats(combinedStats, this.getSlotEffectiveStats(key));
            }
        }

        // Intelligence stat from gear only (no modifiers) for BLU
        const gearIntStat = combinedStats.intelligence;

        // Base stats based on job and level
        for (let statKey of MAIN_STATS) {
            combinedStats[statKey] += Math.floor(levelStats.baseMainStat * classJobStats.jobStatMultipliers[statKey] / 100);
        }
        for (let statKey of FAKE_MAIN_STATS) {
            combinedStats[statKey] += Math.floor(levelStats.baseMainStat);
        }
        for (let statKey of SPECIAL_SUB_STATS) {
            combinedStats[statKey] += Math.floor(levelStats.baseSubStat);
        }

        // Add race stats
        addStats(combinedStats, raceStats);

        // Food stats
        if (this._food) {
            for (let stat in this._food.bonuses) {
                const bonus: StatBonus = this._food.bonuses[stat];
                const startingValue = combinedStats[stat];
                const extraValue = Math.min(bonus.max, Math.floor(startingValue * (bonus.percentage / 100)));
                combinedStats[stat] = startingValue + extraValue;
            }
        }
        const mainStat = Math.floor(combinedStats[classJobStats.mainStat] * (1 + 0.01 * this._sheet.partyBonus));
        const aaStat = Math.floor(combinedStats[classJobStats.autoAttackStat] * (1 + 0.01 * this._sheet.partyBonus));
        const vitEffective = Math.floor(combinedStats.vitality * (1 + 0.01 * this._sheet.partyBonus));
        
        // Add BLU weapon damage modifier
        combinedStats.wdMag += classJob === "BLU" ? bluWdfromInt(gearIntStat) : 0;
        
        const wdEffective = Math.max(combinedStats.wdMag, combinedStats.wdPhys);
        const hp = combinedStats.hp + vitToHp(levelStats, classJobStats, vitEffective);
        const computedStats = {
            ...combinedStats,
            vitality: vitEffective,
            level: level,
            levelStats: levelStats,
            job: classJob,
            jobStats: classJobStats,
            gcdPhys: (base, haste = 0) => sksToGcd(base, levelStats, combinedStats.skillspeed, haste),
            gcdMag: (base, haste = 0) => spsToGcd(base, levelStats, combinedStats.spellspeed, haste),
            hp: hp,
            critChance: critChance(levelStats, combinedStats.crit),
            critMulti: critDmg(levelStats, combinedStats.crit),
            dhitChance: dhitChance(levelStats, combinedStats.dhit),
            dhitMulti: dhitDmg(levelStats, combinedStats.dhit),
            detMulti: detDmg(levelStats, combinedStats.determination),
            spsDotMulti: spsTickMulti(levelStats, combinedStats.spellspeed),
            sksDotMulti: sksTickMulti(levelStats, combinedStats.skillspeed),
            tncMulti: tenacityDmg(levelStats, combinedStats.tenacity),
            // TODO: does this need to be phys/magic split?
            wdMulti: wdMulti(levelStats, classJobStats, wdEffective),
            mainStatMulti: mainStatMulti(levelStats, classJobStats, mainStat),
            aaStatMulti: mainStatMulti(levelStats, classJobStats, aaStat),
            traitMulti: classJobStats.traitMulti ? (type) => classJobStats.traitMulti(level, type) : () => 1,
            autoDhBonus: autoDhBonusDmg(levelStats, combinedStats.dhit),
            mpPerTick: mpTick(levelStats, combinedStats.piety),
            aaMulti: autoAttackModifier(levelStats, classJobStats, combinedStats.weaponDelay, combinedStats.wdPhys)
        }
        if (classJobStats.traits) {
            classJobStats.traits.forEach(trait => {
                if (trait.minLevel && trait.minLevel > level) {
                    return;
                }
                if (trait.maxLevel && trait.maxLevel < level) {
                    return;
                }
                trait.apply(computedStats);
            });
        }
        this._dirtyComp = false;
        if (computedStats.weaponDelay <= 0) {
            computedStats.weaponDelay = 100_000;
        }
        const leftRing = this.getItemInSlot('RingLeft');
        const rightRing = this.getItemInSlot('RingRight');
        const issues: GearSetIssue[] = [];
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
            issues: issues
        }
        console.info("Recomputed stats", this._lastResult);
        return this._lastResult;
    }

    getSlotEffectiveStats(slotId: EquipSlotKey): RawStats {
        const equip = this.equipment[slotId];
        if (!equip.gearItem) {
            return EMPTY_STATS;
        }
        const itemStats = new RawStats(equip.gearItem.stats);
        // Note for future: if we ever get an item that has both custom stats AND materia, this logic will need to be extended.
        for (let stat of ALL_SUB_STATS) {
            const statDetail = this.getStatDetail(slotId, stat);
            if (statDetail instanceof Object) {
                itemStats[stat] = statDetail.effectiveAmount;
            }
            else {
                itemStats[stat] = statDetail;
            }
        }
        return itemStats;
    }

    getStatDetail(slotId: keyof EquipmentSet, stat: RawStatKey, materiaOverride?: Materia[]): ItemSingleStatDetail | number {
        // TODO: work this into the normal stat computation method
        const equip = this.equipment[slotId];
        return this.getEquipStatDetail(equip, stat, materiaOverride);
    }

    getEquipStatDetail(equip: EquippedItem, stat: RawStatKey, materiaOverride?: Materia[]): ItemSingleStatDetail | number {
        const gearItem = equip.gearItem;
        if (!gearItem) {
            return 0;
        }
        const stats = new RawStats(gearItem.stats);
        if (equip.relicStats) {
            let relicStats = new RawStats(equip.relicStats);
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
                    return current;
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
                    return synced;
                }
            }
        }
        const cap = gearItem.statCaps[stat] ?? 9999;
        const baseItemStatValue = stats[stat];
        let meldedStatValue = baseItemStatValue;
        let smallestMateria = 999999;
        const materiaList = materiaOverride === undefined ? equip.melds.map(meld => meld.equippedMateria).filter(item => item) : materiaOverride.filter(item => item);
        for (let materia of materiaList) {
            const materiaStatValue = materia.stats[stat];
            if (materiaStatValue > 0) {
                meldedStatValue += materiaStatValue;
                smallestMateria = Math.min(smallestMateria, materiaStatValue);
            }
        }
        // Not melded or melds are not relevant to this stat
        if (meldedStatValue === baseItemStatValue) {
            return meldedStatValue;
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
            for (let slotKey of (slots === undefined ? EquipSlots : slots)) {
                const equipSlot = this.equipment[slotKey] as EquippedItem | null;
                const gearItem = equipSlot?.gearItem;
                if (gearItem) {
                    equipSlot.melds.forEach(meldSlot => meldSlot.equippedMateria = null);
                }
            }
            this.forceRecalc();
        }
        for (let slotKey of (slots === undefined ? EquipSlots : slots)) {
            const equipSlot = this.equipment[slotKey] as EquippedItem | null;
            const gearItem = equipSlot?.gearItem;
            if (gearItem) {
                materiaLoop: for (let meldSlot of equipSlot.melds) {
                    // If overwriting, we already cleared the slots, so this check is fine in any scenario.
                    if (meldSlot.equippedMateria) {
                        continue;
                    }
                    const slotStats = this.getSlotEffectiveStats(slotKey);
                    // TODO: we also have gearItem.substatCap we can use to make it more direct
                    for (let stat of statPrio) {
                        if (stat === 'skillspeed') {
                            if (this.computedStats.gcdPhys(NORMAL_GCD) <= prio.minGcd) {
                                continue;
                            }
                            this.forceRecalc();
                            if (this.computedStats.gcdPhys(NORMAL_GCD) <= prio.minGcd) {
                                continue;
                            }
                        }
                        if (stat === 'spellspeed') {
                            // Check if we're already there before forcing a recomp
                            if (this.computedStats.gcdMag(NORMAL_GCD) <= prio.minGcd) {
                                continue;
                            }
                            this.forceRecalc();
                            if (this.computedStats.gcdMag(NORMAL_GCD) <= prio.minGcd) {
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
    }
    Object.entries(stats).forEach(([stat, value]) => {
        if (NO_SYNC_STATS.includes(stat as RawStatKey)) {
            return;
        }
        out[stat] = Math.min(value, statCaps[stat] ?? 999999);
    })
    return out;
}

export interface ItemSingleStatDetail {
    effectiveAmount: number,
    fullAmount: number,
    overcapAmount: number,
    cap: number,
    mode: 'unmelded' | 'melded' | 'melded-overcapped' | 'melded-overcapped-major' | 'synced-down';
}

/**
 * Adds the stats of 'addedStats' into 'baseStats'.
 *
 * Modifies 'baseStats' in-place.
 *
 * @param baseStats  The base stat sheet. Will be modified.
 * @param addedStats The stats to add.
 */
function addStats(baseStats: RawStats, addedStats: RawStats): void {
    for (let entry of Object.entries(baseStats)) {
        const stat = entry[0] as keyof RawStats;
        baseStats[stat] = addedStats[stat] + (baseStats[stat] ?? 0);
    }
}

export class XivApiGearInfo implements GearItem {
    id: number;
    name: string;
    /**
     * Raw 'Stats' object from Xivapi
     */
    Stats: Object;
    iconUrl: URL;
    ilvl: number;
    displayGearSlot: DisplayGearSlot;
    displayGearSlotName: DisplayGearSlotKey;
    occGearSlotName: OccGearSlotKey;
    stats: RawStats;
    primarySubstat: keyof RawStats | null;
    secondarySubstat: keyof RawStats | null;
    materiaSlots: MateriaSlot[];
    isCustomRelic: boolean;
    isUnique: boolean;
    unsyncedVersion: XivApiGearInfo;
    acquisitionType: GearAcquisitionSource;
    statCaps: {
        [K in RawStatKey]?: number
    };
    isSyncedDown: boolean;
    relicStatModel: RelicStatModel;

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.ilvl = data['LevelItem'];
        this.iconUrl = xivApiIcon(data['IconHD']);
        this.Stats = data['Stats'] ? data['Stats'] : [];
        const eqs = data['EquipSlotCategory'];
        if (!eqs) {
            console.error('EquipSlotCategory was null!', data);
        }
        else if (eqs['MainHand']) {
            this.displayGearSlotName = 'Weapon';
            if (eqs['OffHand']) {
                this.occGearSlotName = 'Weapon2H'
            }
            else {
                this.occGearSlotName = 'Weapon1H';
            }
        }
        else if (eqs['OffHand']) {
            this.displayGearSlotName = 'OffHand';
            this.occGearSlotName = 'OffHand';
        }
        else if (eqs['Head']) {
            this.displayGearSlotName = 'Head';
            this.occGearSlotName = 'Head';
        }
        else if (eqs['Body']) {
            this.displayGearSlotName = 'Body';
            this.occGearSlotName = 'Body';
        }
        else if (eqs['Gloves']) {
            this.displayGearSlotName = 'Hand';
            this.occGearSlotName = 'Hand';
        }
        else if (eqs['Legs']) {
            this.displayGearSlotName = 'Legs';
            this.occGearSlotName = 'Legs';
        }
        else if (eqs['Feet']) {
            this.displayGearSlotName = 'Feet';
            this.occGearSlotName = 'Feet';
        }
        else if (eqs['Ears']) {
            this.displayGearSlotName = 'Ears';
            this.occGearSlotName = 'Ears';
        }
        else if (eqs['Neck']) {
            this.displayGearSlotName = 'Neck';
            this.occGearSlotName = 'Neck';
        }
        else if (eqs['Wrists']) {
            this.displayGearSlotName = 'Wrist';
            this.occGearSlotName = 'Wrist';
        }
        else if (eqs['FingerL'] || eqs['FingerR']) {
            this.displayGearSlotName = 'Ring';
            this.occGearSlotName = 'Ring';
        }
        else {
            console.error("Unknown slot data!", eqs);
        }
        this.displayGearSlot = this.displayGearSlotName ? DisplayGearSlotInfo[this.displayGearSlotName] : undefined;
        const weaponDelayRaw = data['DelayMs'];
        this.stats = {
            vitality: this.getStatRaw("Vitality"),
            strength: this.getStatRaw("Strength"),
            dexterity: this.getStatRaw("Dexterity"),
            intelligence: this.getStatRaw("Intelligence"),
            mind: this.getStatRaw("Mind"),
            piety: this.getStatRaw("Piety"),
            crit: this.getStatRaw("CriticalHit"),
            dhit: this.getStatRaw("DirectHitRate"),
            determination: this.getStatRaw("Determination"),
            tenacity: this.getStatRaw("Tenacity"),
            spellspeed: this.getStatRaw("SpellSpeed"),
            skillspeed: this.getStatRaw("SkillSpeed"),
            wdPhys: data['DamagePhys'],
            wdMag: data['DamageMag'],
            weaponDelay: weaponDelayRaw ? (weaponDelayRaw / 1000.0) : 0,
            hp: 0
        }
        if (data['CanBeHq']) {
            for (let i = 0; i <= 5; i++) {
                if (data[`BaseParamSpecial${i}TargetID`] === 12) {
                    this.stats.wdPhys += data[`BaseParamValueSpecial${i}`];
                }
                else if (data[`BaseParamSpecial${i}TargetID`] === 13) {
                    this.stats.wdMag += data[`BaseParamValueSpecial${i}`];
                }
            }
        }
        this.isUnique = Boolean(data['IsUnique']);
        this.computeSubstats();
        this.materiaSlots = [];
        const baseMatCount: number = data['MateriaSlotCount'];
        if (baseMatCount === 0) {
            // TODO: is this branch still needed?
            if (this.displayGearSlot !== DisplayGearSlotInfo.OffHand) {
                this.isCustomRelic = true;
            }
            else if (!this.primarySubstat) {
                this.isCustomRelic = true;
            }
            else {
                this.isCustomRelic = false;
            }
        }
        else {
            this.isCustomRelic = false;
            const overmeld: boolean = data['IsAdvancedMeldingPermitted'] as boolean;
            for (let i = 0; i < baseMatCount; i++) {
                // TODO: figure out grade automatically
                this.materiaSlots.push({
                    maxGrade: MATERIA_LEVEL_MAX_NORMAL,
                    allowsHighGrade: true
                });
            }
            if (overmeld) {
                this.materiaSlots.push({
                    maxGrade: MATERIA_LEVEL_MAX_NORMAL,
                    allowsHighGrade: true
                })
                for (let i = this.materiaSlots.length; i < MATERIA_SLOTS_MAX; i++) {
                    this.materiaSlots.push({
                        maxGrade: MATERIA_LEVEL_MAX_OVERMELD,
                        allowsHighGrade: false
                    });
                }
            }
        }
        try {
            const rarity: number = data['Rarity'];
            const isCraftable = data['GameContentLinks']?.['Recipe'];
            const hasShop = data['GameContentLinks']?.['SpecialShop'];
            switch (rarity) {
                // Green
                case 2:
                    if (this.name.includes('Augmented')) {
                        this.acquisitionType = 'augcrafted';
                    }
                    else {
                        if (isCraftable) {
                            this.acquisitionType = 'crafted';
                        }
                        else {
                            this.acquisitionType = 'dungeon';
                        }
                    }
                    break;
                // Blue
                case 3:
                    // TODO: how to differentiate raid vs tome vs aug tome?
                    // Aug tome: it has "augmented" in the name, easy
                    const isWeaponOrOH = this.occGearSlotName === 'Weapon2H' || this.occGearSlotName === 'Weapon1H' || this.occGearSlotName === 'OffHand';
                    if (ARTIFACT_ITEM_LEVELS.includes(this.ilvl)) {
                        // Ambiguous due to start-of-expac ex trials
                        if (isWeaponOrOH) {
                            this.acquisitionType = 'other';
                        }
                        else {
                            this.acquisitionType = 'artifact';
                        }
                    }
                    // Start-of-expac uncapped tome gear
                    else if (BASIC_TOME_GEAR_ILVLS.includes(this.ilvl)) {
                        this.acquisitionType = 'tome';
                    }
                    const chkRelIlvl = (relativeToRaidTier: number) => {
                        return RAID_TIER_ILVLS.includes(this.ilvl - relativeToRaidTier);
                    };
                    if (chkRelIlvl(0)) {
                        if (this.name.includes('Augmented')) {
                            this.acquisitionType = 'augtome';
                        }
                        else {
                            this.acquisitionType = 'raid';
                        }
                    }
                    else if (chkRelIlvl(-10)) {
                        if (hasShop) {
                            this.acquisitionType = 'tome';
                        }
                        else {
                            this.acquisitionType = 'alliance';
                        }
                    }
                    else if (chkRelIlvl(-20)) {

                        if (isWeaponOrOH) {
                            this.acquisitionType = 'extrial';
                        }
                        else {
                            // Ambiguous - first-of-the-expac extreme trial accessories and normal raid
                            // accessories share the same ilvl
                            this.acquisitionType = 'other';
                        }
                    }
                    else if ((chkRelIlvl(-5) || chkRelIlvl(-15)) && isWeaponOrOH) {
                        this.acquisitionType = 'extrial';
                    }
                    else if (this.ilvl % 10 === 5) {
                        if (isWeaponOrOH) {
                            if (chkRelIlvl(5)) {
                                if (this.name.includes('Ultimate')) {
                                    this.acquisitionType = 'ultimate';
                                }
                                else {
                                    this.acquisitionType = 'raid';
                                }
                            }
                        }
                    }
                    break;
                // Purple
                case 4:
                    this.acquisitionType = 'relic';
                    break;
            }
        }
        catch (e) {
            console.error("Error determining item rarity", data);
        }
        if (!this.acquisitionType) {
            console.warn(`Unable to determine acquisition source for item ${this.name} (${this.id})`, data);
            this.acquisitionType = 'other';
        }
    }

    private computeSubstats() {
        const sortedStats = Object.entries({
            crit: this.stats.crit,
            dhit: this.stats.dhit,
            determination: this.stats.determination,
            spellspeed: this.stats.spellspeed,
            skillspeed: this.stats.skillspeed,
            piety: this.stats.piety,
            tenacity: this.stats.tenacity,
        })
            .sort((left, right) => {
                if (left[1] > right[1]) {
                    return 1;
                }
                else if (left[1] < right[1]) {
                    return -1;
                }
                return 0;
            })
            .filter(item => item[1])
            .reverse();
        if (sortedStats.length < 2) {
            this.primarySubstat = null;
            this.secondarySubstat = null;
        }
        else {
            this.primarySubstat = sortedStats[0][0] as keyof RawStats;
            this.secondarySubstat = sortedStats[1][0] as keyof RawStats;
        }
    }

    /**
     * TODO fix docs for this
     */
    applyIlvlData(nativeIlvlInfo: IlvlSyncInfo, syncIlvlInfo?: IlvlSyncInfo) {
        const statCapsNative = {}
        Object.entries(this.stats).forEach(([stat, _]) => {
            statCapsNative[stat] = nativeIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
        });
        this.statCaps = statCapsNative;
        if (syncIlvlInfo && syncIlvlInfo.ilvl < this.ilvl) {
            this.unsyncedVersion = {
                ...this
            };
            this.materiaSlots = [];
            const statCapsSync = {}
            Object.entries(this.stats).forEach(([stat, v]) => {
                statCapsSync[stat] = syncIlvlInfo.substatCap(this.occGearSlotName, stat as RawStatKey);
            });
            this.stats = applyStatCaps(this.stats, statCapsSync);
            this.statCaps = statCapsSync;
            this.computeSubstats();
            this.isSyncedDown = true;
        }
        else {
            this.unsyncedVersion = this;
            this.isSyncedDown = false;
        }
    }

    private getStatRaw(stat: XivApiStat) {
        const statValues = this.Stats[stat];
        if (statValues === undefined) {
            return 0;
        }
        if (statValues['HQ'] !== undefined) {
            return statValues['HQ'];
        }
        else {
            return statValues['NQ'];
        }
    }
}

export class XivApiFoodInfo implements FoodItem {
    bonuses: {
        [K in keyof RawStats]?: {
            percentage: number;
            max: number
        }
    } = {};
    iconUrl: URL;
    id: number;
    name: string;
    ilvl: number;
    primarySubStat: RawStatKey | undefined;
    secondarySubStat: RawStatKey | undefined;

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.iconUrl = new URL("https://xivapi.com/" + data['IconHD']);
        this.ilvl = data['LevelItem'];
        for (let key in data['Bonuses']) {
            const bonusData = data['Bonuses'][key];
            this.bonuses[xivApiStatMapping[key as RawStatKey]] = {
                percentage: bonusData['ValueHQ'] ?? bonusData['Value'],
                max: bonusData['MaxHQ'] ?? bonusData['Max']
            }
        }
        const sortedStats = Object.entries(this.bonuses).sort((entryA, entryB) => entryB[1].max - entryA[1].max).map(entry => entry[0] as RawStatKey).filter(stat => stat !== 'vitality');
        if (sortedStats.length >= 1) {
            this.primarySubStat = sortedStats[0];
        }
        if (sortedStats.length >= 2) {
            this.secondarySubStat = sortedStats[1];
        }
    }

}

export function processRawMateriaInfo(data: Object): Materia[] {
    const out: Materia[] = []
    for (let i = MATERIA_LEVEL_MIN_RELEVANT - 1; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
        const itemData = data['Item' + i];
        const itemName = itemData["Name"];
        const stats = new RawStats();
        const stat = statById(data['BaseParam']['ID']);
        if (!stat || !itemName) {
            continue;
        }
        stats[stat] = data['Value' + i];
        const grade = (i + 1);
        out.push({
            name: itemName,
            id: itemData["ID"],
            iconUrl: new URL("https://xivapi.com/" + itemData["IconHD"]),
            stats: stats,
            primaryStat: stat,
            primaryStatValue: stats[stat],
            materiaGrade: grade,
            isHighGrade: (grade % 2) === 0
        });
    }
    return out;
}

