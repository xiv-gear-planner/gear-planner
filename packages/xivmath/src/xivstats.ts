import {
    AttackType,
    ComputedSetStats,
    FoodBonuses,
    FoodItem,
    FoodStatBonus,
    JobData,
    LevelStats,
    PartyBonusAmount,
    RawStatKey,
    RawStats
} from "./geartypes";
import {
    autoAttackModifier,
    autoCritBuffDmg,
    autoDhitBonusDmg,
    autoDhitBuffDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg,
    fl,
    mainStatMulti,
    mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    tenacityDmg,
    tenacityIncomingDmg,
    vitToHp,
    wdMulti
} from "./xivmath";
import {getRaceStats, JobName, RaceName, SupportedLevel} from "./xivconstants";
import {sum} from "@xivgear/util/array_utils";

/**
 * Adds the stats of 'addedStats' into 'baseStats'.
 *
 * Modifies 'baseStats' in-place.
 *
 * @param baseStats  The base stat sheet. Will be modified.
 * @param addedStats The stats to add.
 */
export function addStats(baseStats: RawStats, addedStats: RawStats): void {
    for (const entry of Object.entries(baseStats)) {
        const stat = entry[0] as keyof RawStats;
        baseStats[stat] = addedStats[stat] + (baseStats[stat] ?? 0);
    }
}

/**
 * Function from an attack type to a haste amount. Haste amount is percentage, e.g. 20 haste = 20% faster.
 */
export type HasteBonus = (attackType: AttackType) => number;

/**
 * Represents a post-computation stat modification (e.g. a crit chance buff).
 *
 * The modifier should modify the 'bonuses' object in-place.
 */
export type StatModification = (stats: ComputedSetStats, bonuses: RawBonusStats) => void;

/**
 * Represents a stat modification that is applied earlier in the process compared to {@link StatModification}.
 * This allows you to change the "base" values rather than merely applying final bonuses.
 */
export type StatPreModifications = {
    newFoodBonuses?: FoodBonuses | null,
}

/**
 * Represents post-computation stat modifications.
 */
export class RawBonusStats extends RawStats {
    critChance: number = 0;
    critDmg: number = 0;
    dhitChance: number = 0;
    dhitDmg: number = 0;
    detMulti: number = 0;
    bonusHaste: HasteBonus[] = [];
    // TODO: These should be used when possible
    forceCrit: boolean = false;
    forceDh: boolean = false;
}

function clamp(min: number, max: number, value: number) {
    return Math.max(Math.min(value, max), min);
}

/**
 * Transform a ComputedSetStats into a form that serializes properly. That is, it serializes the getters rather
 * than only the backing data. This is realistically what you would want out of the fulldata API endpoint.
 *
 * @param stats
 */
export function statsSerializationProxy(stats: ComputedSetStats): ComputedSetStats {
    // The purpose of this is that the fullstats API won't correctly serialize the ComputedSetStatsImpl normally.
    // We care about the
    return new Proxy(stats, {
        get(target, prop, receiver) {
            // Check if the property is a getter on the prototype chain
            let descriptor = Object.getOwnPropertyDescriptor(target, prop as string);
            let proto = Object.getPrototypeOf(target);

            while (!descriptor && proto) {
                descriptor = Object.getOwnPropertyDescriptor(proto, prop as string);
                proto = Object.getPrototypeOf(proto);
            }

            if (descriptor && typeof descriptor.get === 'function') {
                return descriptor.get.call(target);
            }

            return Reflect.get(target, prop, receiver);
        },
        ownKeys(target) {
            const keys = new Set<string | symbol>();

            let obj: object = target;
            while (obj) {
                Reflect.ownKeys(obj).forEach((key) => {
                    if (typeof key === 'string' && !key.startsWith('_')) {
                        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
                        if (descriptor && typeof descriptor.get === 'function') {
                            keys.add(key);
                        }
                    }
                });
                obj = Object.getPrototypeOf(obj);
            }

            return Array.from(keys);
        },
        getOwnPropertyDescriptor(target, prop) {
            const descriptor = Object.getOwnPropertyDescriptor(target, prop) ||
                Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), prop);

            if (
                descriptor &&
                typeof descriptor.get === 'function' &&
                typeof prop === 'string' &&
                !prop.startsWith('_')
            ) {
                return {
                    enumerable: true,
                    configurable: true,
                };
            }
            return undefined;
        },
    });
}

/**
 * ComputedSetStats implementation.
 *
 * Unlike the old ComputedSetStats, this should not be modified. Rather, if a modified version is required,
 * then the {@link #withModifications()} method should be used, which will apply the allowable modifications and
 * return a new object. Derived values do not need to be explicitly recomputed, e.g. if you apply a main stat bonus,
 * the main stat multiplier will take effect automatically.
 */
export class ComputedSetStatsImpl implements ComputedSetStats {

    protected readonly finalBonusStats: RawBonusStats;
    // This is initialized when the ctor calls this.recalc()
    private currentStats!: RawStats;
    private _racialStats: RawStats;
    private _effectiveFoodBonuses!: RawStats;

    constructor(
        readonly gearStats: RawStats,
        private readonly foodStats: FoodBonuses,
        readonly level: SupportedLevel,
        readonly levelStats: LevelStats,
        private readonly classJob: JobName,
        private readonly classJobStats: JobData,
        readonly partyBonus: PartyBonusAmount,
        private readonly race: RaceName
    ) {
        this.finalBonusStats = new RawBonusStats();
        // TODO: order of operations here
        this.recalc();
        if (classJobStats.traits) {
            classJobStats.traits.forEach(trait => {
                if (trait.minLevel && trait.minLevel > level) {
                    return;
                }
                if (trait.maxLevel && trait.maxLevel < level) {
                    return;
                }
                trait.apply(this.finalBonusStats);
            });
        }

        const racialStats = new RawStats({
            vitality: 20,
            strength: 20,
            intelligence: 20,
            dexterity: 20,
            mind: 20,
        });
        const racialBonus = getRaceStats(this.race);
        if (racialBonus) {
            if (racialBonus.vitality) {
                racialStats['vitality'] += racialBonus.vitality;
            }
            if (racialBonus.strength) {
                racialStats['strength'] += racialBonus.strength;
            }
            if (racialBonus.intelligence) {
                racialStats['intelligence'] += racialBonus.intelligence;
            }
            if (racialBonus.dexterity) {
                racialStats['dexterity'] += racialBonus.dexterity;
            }
            if (racialBonus.mind) {
                racialStats['mind'] += racialBonus.mind;
            }
        }
        this._racialStats = racialStats;
    }

    private recalc() {
        const finalized = finalizeStatsInt(
            this.gearStats,
            this.foodStats,
            this.level,
            this.levelStats,
            this.classJob,
            this.classJobStats,
            this.partyBonus
        );
        this.currentStats = finalized.raw;
        this._effectiveFoodBonuses = finalized.effectiveFoodBonuses;
    }

    withModifications(modifications: StatModification, pre: StatPreModifications = {}): ComputedSetStatsImpl {
        const out = new ComputedSetStatsImpl(
            this.gearStats,
            // If the new food is not specified, use current food.
            // If the new food is null, use empty food.
            // If the new food is not null, use its bonuses.
            'newFood' in pre ? (pre.newFood ?? {}) : this.foodStats,
            this.level,
            this.levelStats,
            this.classJob,
            this.classJobStats,
            this.partyBonus,
            this.race
        );
        Object.assign(out.finalBonusStats, this.finalBonusStats);
        modifications(out, out.finalBonusStats);
        return out;
    }

    gcdPhys(baseGcd: number, haste?: number): number {
        return sksToGcd(baseGcd, this.levelStats, this.skillspeed, haste);
    }

    gcdMag(baseGcd: number, haste?: number): number {
        return spsToGcd(baseGcd, this.levelStats, this.spellspeed, haste);
    }

    haste(attackType: AttackType): number {
        return sum(this.finalBonusStats.bonusHaste.map(hb => hb(attackType)));
    }

    traitMulti(attackType: AttackType): number {
        return this.classJobStats.traitMulti?.(this.level, attackType) ?? 1.0;
    }

    get hp(): number {
        return this.currentStats.hp + this.finalBonusStats.hp + vitToHp(this.levelStats, this.classJobStats, this.vitality);
    }

    get vitality(): number {
        return this.currentStats.vitality + this.finalBonusStats.vitality;
    }

    get strength(): number {
        return this.currentStats.strength + this.finalBonusStats.strength;
    }

    get dexterity(): number {
        return this.currentStats.dexterity + this.finalBonusStats.dexterity;
    }

    get intelligence(): number {
        return this.currentStats.intelligence + this.finalBonusStats.intelligence;
    }

    get mind(): number {
        return this.currentStats.mind + this.finalBonusStats.mind;
    }

    get piety(): number {
        return this.currentStats.piety + this.finalBonusStats.piety;
    }

    get crit(): number {
        return this.currentStats.crit + this.finalBonusStats.crit;
    }

    get dhit(): number {
        return this.currentStats.dhit + this.finalBonusStats.dhit;
    }

    get determination(): number {
        return this.currentStats.determination + this.finalBonusStats.determination;
    }

    get tenacity(): number {
        return this.currentStats.tenacity + this.finalBonusStats.tenacity;
    }

    get skillspeed(): number {
        return this.currentStats.skillspeed + this.finalBonusStats.skillspeed;
    }

    get spellspeed(): number {
        return this.currentStats.spellspeed + this.finalBonusStats.spellspeed;
    }

    get wdPhys(): number {
        return this.currentStats.wdPhys + this.finalBonusStats.wdPhys;
    }

    get wdMag(): number {
        return this.currentStats.wdMag + this.finalBonusStats.wdMag;
    }

    get weaponDelay(): number {
        const result = this.currentStats.weaponDelay + this.finalBonusStats.weaponDelay;
        if (result <= 0) {
            // Return large value since that's better than trying to divide by zero
            return 100_000;
        }
        return result;
    }

    get job(): JobName {
        return this.classJob;
    }

    get jobStats(): JobData {
        return this.classJobStats;
    }

    get racialStats(): RawStats {
        return this._racialStats;
    }

    get baseCritChance(): number {
        return clamp(0, 1, critChance(this.levelStats, this.crit));
    }

    get critChance(): number {
        if (this.finalBonusStats.forceCrit) {
            return 1;
        }
        return clamp(0, 1, this.baseCritChance + this.finalBonusStats.critChance);
    }

    get critMulti(): number {
        return critDmg(this.levelStats, this.crit) + this.finalBonusStats.critDmg;
    };

    get baseDhitChance(): number {
        return clamp(0, 1, dhitChance(this.levelStats, this.dhit));
    }

    get dhitChance(): number {
        if (this.finalBonusStats.forceDh) {
            return 1;
        }
        return clamp(0, 1, this.baseDhitChance + this.finalBonusStats.dhitChance);
    };

    get dhitMulti(): number {
        return dhitDmg(this.levelStats, this.dhit) + this.finalBonusStats.dhitDmg;
    };

    get detMulti(): number {
        return detDmg(this.levelStats, this.determination) + this.finalBonusStats.detMulti;
    };

    get spsDotMulti(): number {
        return spsTickMulti(this.levelStats, this.spellspeed);
    };

    get sksDotMulti(): number {
        return sksTickMulti(this.levelStats, this.skillspeed);
    };

    get tncMulti(): number {
        return tenacityDmg(this.levelStats, this.tenacity);
    };

    get tncIncomingMulti(): number {
        return tenacityIncomingDmg(this.levelStats, this.tenacity);
    };

    get wdMulti(): number {
        const wdEffective = Math.max(this.wdMag, this.wdPhys);
        return wdMulti(this.levelStats, this.classJobStats, wdEffective);
    };

    get mainStatValue(): number {
        return this[this.classJobStats.mainStat];
    }

    get mainStatMulti(): number {
        return mainStatMulti(this.levelStats, this.classJobStats, this.mainStatValue);
    };

    get aaStatMulti(): number {
        return mainStatMulti(this.levelStats, this.classJobStats, this[this.classJobStats.autoAttackStat]);
    };

    get wdMultiPetAction(): number {
        const wdEffective = Math.max(this.wdMag, this.wdPhys);
        return wdMulti(this.levelStats, this.classJobStats, wdEffective, true);
    };

    get autoDhBonus(): number {
        return autoDhitBonusDmg(this.levelStats, this.dhit);
    };

    get autoCritBuffMulti(): number {
        return autoCritBuffDmg(this.critMulti, this.finalBonusStats.critChance);
    }

    get autoDhitBuffMulti(): number {
        return autoDhitBuffDmg(this.dhitMulti, this.finalBonusStats.dhitChance);
    }

    get mpPerTick(): number {
        return mpTick(this.levelStats, this.piety);
    };

    get aaMulti(): number {
        return autoAttackModifier(this.levelStats, this.classJobStats, this.weaponDelay, this.wdPhys);
    };

    get aaDelay(): number {
        return this.weaponDelay;
    };

    get effectiveFoodBonuses(): RawStats {
        return this._effectiveFoodBonuses;
    }
}

export function finalizeStats(
    gearStats: RawStats,
    foodStats: FoodBonuses,
    level: SupportedLevel,
    levelStats: LevelStats,
    classJob: JobName,
    classJobStats: JobData,
    partyBonus: PartyBonusAmount,
    race: RaceName
) {
    return new ComputedSetStatsImpl(
        gearStats, foodStats, level, levelStats, classJob, classJobStats, partyBonus, race
    );

}

function finalizeStatsInt(
    // TODO: gearStats is currently gear + race/job base stuff. Separate these out.
    gearStats: RawStats,
    foodStats: FoodBonuses,
    level: SupportedLevel,
    levelStats: LevelStats,
    classJob: JobName,
    classJobStats: JobData,
    partyBonus: PartyBonusAmount
): {
    raw: RawStats,
    effectiveFoodBonuses: RawStats
} {
    const combinedStats: RawStats = {...gearStats};
    const mainStatKey = classJobStats.mainStat;
    const aaStatKey = classJobStats.autoAttackStat;
    combinedStats[mainStatKey] = fl(combinedStats[mainStatKey] * (1 + 0.01 * partyBonus));
    if (mainStatKey !== aaStatKey) {
        combinedStats[aaStatKey] = fl(combinedStats[aaStatKey] * (1 + 0.01 * partyBonus));
    }
    combinedStats.vitality = fl(combinedStats.vitality * (1 + 0.01 * partyBonus));
    const effectiveFoodBonuses = new RawStats();
    // Food stats
    for (const key in foodStats) {
        const stat = key as RawStatKey;
        // These operate on base values, without the party buff
        const bonus: FoodStatBonus | undefined = foodStats[stat];
        if (bonus !== undefined) {
            const startingValue = gearStats[stat];
            const extraValue = Math.min(bonus.max, Math.floor(startingValue * (bonus.percentage / 100)));
            combinedStats[stat] += extraValue;
            effectiveFoodBonuses[stat] += extraValue;
        }
    }
    return {
        raw: combinedStats,
        effectiveFoodBonuses: effectiveFoodBonuses,
    };
}
