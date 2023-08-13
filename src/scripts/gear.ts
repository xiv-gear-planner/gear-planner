import {
    ALL_SUB_STATS,
    EMPTY_STATS,
    FAKE_MAIN_STATS,
    getClassJobStats,
    getLevelStats,
    getRaceStats,
    JobName,
    MATERIA_LEVEL_MAX_NORMAL,
    MATERIA_LEVEL_MAX_OVERMELD,
    MATERIA_LEVEL_MIN_RELEVANT,
    MATERIA_SLOTS_MAX,
    MateriaSubstat,
    RaceName,
    REAL_MAIN_STATS,
    SPECIAL_SUB_STATS,
    statById,
} from "./xivconstants";
import {
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
    wdMulti
} from "./xivmath";
import {
    ComputedSetStats,
    EquipmentSet,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    GearItem,
    GearSlot,
    GearSlotInfo,
    Materia,
    MateriaAutoFillController,
    MateriaSlot,
    MeldableMateriaSlot,
    RawStatKey,
    RawStats,
    StatBonus,
    XivApiStat,
    xivApiStatToRawStatKey,
    XivCombatItem
} from "./geartypes";
import {GearPlanSheet} from "./components";
import {xivApiIcon} from "./external/xivapi";


export class EquippedItem {
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
    }

    gearItem: GearItem;
    melds: MeldableMateriaSlot[];
}

/**
 * Class representing equipped gear, food, and other overrides.
 */
export class CharacterGearSet {
    _name: string;
    equipment: EquipmentSet;
    listeners: (() => void)[] = [];
    private _dirtyComp: boolean = true;
    private _updateKey: number = 0;
    private _computedStats: ComputedSetStats;
    private _jobOverride: JobName;
    private _raceOverride: RaceName;
    private _food: FoodItem;
    private _sheet: GearPlanSheet;

    constructor(sheet: GearPlanSheet) {
        this._sheet = sheet;
        this.name = ""
        this.equipment = new EquipmentSet();
    }

    get updateKey() {
        return this._updateKey;
    }

    set name(name) {
        this._name = name;
        this.notifyListeners();
    }

    get name() {
        return this._name;
    }

    get food(): FoodItem | undefined {
        return this._food;
    }

    private invalidate() {
        this._dirtyComp = true;
        this._updateKey++;
    }

    set food(food: FoodItem | undefined) {
        this.invalidate();
        this._food = food;
        console.log(`Set ${this.name}: food => ${food.name}`);
        this.notifyListeners();
    }

    setEquip(slot: EquipSlotKey, item: GearItem, materiaAutoFill?: MateriaAutoFillController) {
        this.invalidate();
        this.equipment[slot] = new EquippedItem(item);
        console.log(`Set ${this.name}: slot ${slot} => ${item.name}`);
        if (materiaAutoFill && materiaAutoFill.autoFillNewItem) {
            this.fillMateria(materiaAutoFill.statPrio, false, [slot]);
        }
        this.notifyListeners()
    }

    private notifyListeners() {
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

    get computedStats(): ComputedSetStats {
        if (!this._dirtyComp) {
            return this._computedStats;
        }
        const combinedStats = new RawStats(EMPTY_STATS);
        const classJob = this._jobOverride ?? this._sheet.classJobName;
        const classJobStats = this._jobOverride ? getClassJobStats(this._jobOverride) : this._sheet.classJobStats;
        const raceStats = this._raceOverride ? getRaceStats(this._raceOverride) : this._sheet.raceStats;
        const level = this._sheet.level;
        const levelStats = getLevelStats(level);

        // Base stats based on job and level
        for (let statKey of REAL_MAIN_STATS) {
            combinedStats[statKey] = Math.floor(levelStats.baseMainStat * classJobStats.jobStatMulipliers[statKey] / 100);
        }
        for (let statKey of FAKE_MAIN_STATS) {
            combinedStats[statKey] = Math.floor(levelStats.baseMainStat);
        }
        for (let statKey of SPECIAL_SUB_STATS) {
            combinedStats[statKey] = Math.floor(levelStats.baseSubStat);
        }

        // Add race stats
        addStats(combinedStats, raceStats);

        // Item stats
        for (let key of EquipSlots) {
            if (this.equipment[key]) {
                addStats(combinedStats, this.getSlotEffectiveStats(key));
            }
        }
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
        this._computedStats = {
            ...combinedStats,
            level: level,
            levelStats: levelStats,
            job: classJob,
            jobStats: classJobStats,
            gcdPhys: base => sksToGcd(base, levelStats, combinedStats.skillspeed),
            gcdMag: base => spsToGcd(base, levelStats, combinedStats.spellspeed),
            critChance: critChance(levelStats, combinedStats.crit),
            critMulti: critDmg(levelStats, combinedStats.crit),
            dhitChance: dhitChance(levelStats, combinedStats.dhit),
            dhitMulti: dhitDmg(levelStats, combinedStats.dhit),
            detMulti: detDmg(levelStats, combinedStats.determination),
            spsDotMulti: spsTickMulti(levelStats, combinedStats.spellspeed),
            sksDotMulti: sksTickMulti(levelStats, combinedStats.skillspeed),
            // TODO: does this need to be phys/magic split?
            wdMulti: wdMulti(levelStats, classJobStats, Math.max(combinedStats.wdMag, combinedStats.wdPhys)),
            mainStatMulti: mainStatMulti(levelStats, classJobStats, mainStat),
            traitMulti: classJobStats.traitMulti ? (type) => classJobStats.traitMulti(level, type) : () => 1,
            autoDhBonus: autoDhBonusDmg(levelStats, combinedStats.dhit),
            mpPerTick: mpTick(levelStats, combinedStats.piety),
        }
        if (classJobStats.traits) {
            classJobStats.traits.forEach(trait => {
                if (trait.minLevel && trait.minLevel > level) {
                    return;
                }
                if (trait.maxLevel && trait.maxLevel < level) {
                    return;
                }
                trait.apply(this._computedStats);
            });
        }
        this._dirtyComp = false;
        console.info("Recomputed stats");
        return this._computedStats;
    }

    // clone(): CharacterGearSet {
    //     const out = new CharacterGearSet(this._sheet);
    //     for (let slot in this.equipment) {
    //         const equip: EquippedItem = this.equipment[slot];
    //         if (!equip) {
    //             continue;
    //         }
    //         out.equipment[slot] = new EquippedItem(equip.gearItem, equip.melds);
    //     }
    //     out.name = this.name + ' copy';
    //     return out;
    // }

    getSlotEffectiveStats(slotId: EquipSlotKey): RawStats {
        const equip = this.equipment[slotId];
        if (!equip.gearItem) {
            return EMPTY_STATS;
        }
        const itemStats = new RawStats(equip.gearItem.stats);
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
        if (!equip.gearItem) {
            return 0;
        }
        const cap = equip.gearItem.substatCap;
        const baseItemStatValue = equip.gearItem.stats[stat];
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
     * @param statPrio The priority of stats.
     * @param overwrite true to fill all slots, even if already occupied. false to only fill empty slots.
     * @param slots Omit to fill all slots. Specify one or more slots to specifically fill those slots.
     */
    fillMateria(statPrio: MateriaSubstat[], overwrite: boolean, slots?: EquipSlotKey[]) {
        for (let slotKey of (slots === undefined ? EquipSlots : slots)) {
            const equipSlot = this.equipment[slotKey] as EquippedItem | null;
            const gearItem = equipSlot?.gearItem;
            if (gearItem) {
                // If overwriting, delete everything
                if (overwrite) {
                    equipSlot.melds.forEach(meldSlot => meldSlot.equippedMateria = null);
                }
                const cap = gearItem.substatCap;
                materiaLoop: for (let meldSlot of equipSlot.melds) {
                    // If overwriting, we already cleared the slots, so this check is fine in any scenario.
                    if (meldSlot.equippedMateria) {
                        continue;
                    }
                    const slotStats = this.getSlotEffectiveStats(slotKey);
                    // TODO: we also have gearItem.substatCap we can use to make it more direct
                    for (let stat of statPrio) {
                        const newMateria: Materia = this._sheet.getBestMateria(stat, meldSlot);
                        if (!newMateria) {
                            continue;
                        }
                        // TODO make this a setting?
                        // console.log(`Materia Fill: ${stat} ${newMateria.primaryStatValue} ${slotStats[stat]} ${cap}`);
                        // Allow for losing 1 or 2 stat points
                        if (newMateria.primaryStatValue + slotStats[stat] - 2 < cap) {
                            meldSlot.equippedMateria = newMateria;
                            continue materiaLoop;
                        }
                    }
                }
            }
        }
        this.forceRecalc();
    }
}

export interface ItemSingleStatDetail {
    effectiveAmount: number,
    fullAmount: number,
    overcapAmount: number,
    cap: number,
    mode: 'unmelded' | 'melded' | 'melded-overcapped' | 'melded-overcapped-major';
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
    Stats: Object;
    iconUrl: URL;
    ilvl: number;
    gearSlot: GearSlot;
    stats: RawStats;
    primarySubstat: keyof RawStats | null;
    secondarySubstat: keyof RawStats | null;
    substatCap: number;
    materiaSlots: MateriaSlot[];

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.ilvl = data['LevelItem'];
        this.iconUrl = xivApiIcon(data['IconHD']);
        this.Stats = data['Stats'];
        const eqs = data['EquipSlotCategory'];
        if (!eqs) {
            console.error('EquipSlotCategory was null!', data);
        }
        else if (eqs['MainHand']) {
            this.gearSlot = GearSlotInfo.Weapon;
        }
        else if (eqs['Head']) {
            this.gearSlot = GearSlotInfo.Head;
        }
        else if (eqs['Body']) {
            this.gearSlot = GearSlotInfo.Body;
        }
        else if (eqs['Gloves']) {
            this.gearSlot = GearSlotInfo.Hand;
        }
        else if (eqs['Legs']) {
            this.gearSlot = GearSlotInfo.Legs;
        }
        else if (eqs['Feet']) {
            this.gearSlot = GearSlotInfo.Feet;
        }
        else if (eqs['Ears']) {
            this.gearSlot = GearSlotInfo.Ears;
        }
        else if (eqs['Neck']) {
            this.gearSlot = GearSlotInfo.Neck;
        }
        else if (eqs['Wrists']) {
            this.gearSlot = GearSlotInfo.Wrist;
        }
        else if (eqs['FingerL'] || eqs['FingerR']) {
            this.gearSlot = GearSlotInfo.Ring;
        }
        else {
            console.error("Unknown slot data!")
            console.error(eqs);
        }

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
            hp: 0
        }
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
            // TODO idk
            this.substatCap = 1000;
        }
        else {
            this.primarySubstat = sortedStats[0][0] as keyof RawStats;
            this.secondarySubstat = sortedStats[1][0] as keyof RawStats;
            this.substatCap = sortedStats[0][1];
        }
        this.materiaSlots = [];
        const baseMatCount: number = data['MateriaSlotCount'];
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
    bonuses: { [K in keyof RawStats]?: { percentage: number; max: number } } = {};
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
            this.bonuses[xivApiStatToRawStatKey[key as RawStatKey]] = {
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

