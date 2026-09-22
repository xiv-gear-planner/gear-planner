import {CharacterGearSet} from "@xivgear/core/gear";
import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {
    ComputedDamage,
    DamagingAbility,
    SimResult,
    SimSettings,
    SimSpec,
    Simulation
} from "@xivgear/core/sims/sim_types";
import {
    fl, flp, trunc,
    applyDhCritFull
} from "@xivgear/xivmath/xivmath";
import {addValues, multiplyFixed, multiplyIndependent, fixedValue, ValueWithDev, applyStdDev} from "@xivgear/xivmath/deviation";
import * as Actions from "./blm_actions";

// A normal rotation is:
// 100: B3 B4 Para F3 Para 6xF4 Desp FS
// 90: B3 B4 Para F3 Para 6xF4 Desp
// 80: B3 B4 F3 7xF4 Desp
// 70: B3 B4 F3 7xF4

// Manafont value is:
// 100: F3P Para 6xF4 Desp FS
// 90: F3P Para 6xF4 Desp
// 80: 7xF4 Desp
// 70: 7xF4

const el3Penalty = 0.7;
const af1Mult = 1.4;
const af3Mult = 1.8;

const fastF3 = el3Penalty * Actions.Fire3.potency;
const fastB3 = el3Penalty * Actions.Blizzard3.potency;
const coldB3 = Actions.Blizzard3.potency;
const B4 = Actions.Blizzard4.potency;
const Xeno = Actions.Xenoglossy.potency;
const Foul = Actions.Foul.potency;
const hotF3 = af1Mult * Actions.Fire3.potency;
const af3F3P = af3Mult * Actions.Fire3.potency;
const F4 = af3Mult * Actions.Fire4.potency;
const Desp = af3Mult * Actions.Despair.potency;
const Para = Actions.FireParadox.potency;
const HT = Actions.HighThunder.potency;
const HTdot = (Actions.HighThunder as DamagingAbility).dot.tickPotency;
const HTdur = (Actions.HighThunder as DamagingAbility).dot.duration as number;
const HTticks = HTdur / 3;
const T3 = Actions.Thunder3.potency;
const T3dot = (Actions.Thunder3 as DamagingAbility).dot.tickPotency;
const T3dur = (Actions.Thunder3 as DamagingAbility).dot.duration as number;
const T3ticks = T3dur / 3;
const FS = af3Mult * Actions.FlareStar.potency;

const LLscalar = 120 / ((20 / 0.85) + 100);
const numF4Rots = 4;

export interface BlmPpsResult extends SimResult {
    mainDpsFull: ValueWithDev,
    pps: number,
    ppsWithEno: number,
}

export interface BlmPpsSettings extends SimSettings {
    useStandardF3P: boolean,
    spendManafontF3P: boolean,
    useColdB3: boolean,
    stdDevs: number,
}

export type BlmPpsSettingsExternal = {
    customSettings: BlmPpsSettings,
}

export const blmPpsSpec: SimSpec<BlmPpsSim, BlmPpsSettingsExternal> = {
    stub: "blm-pps-sim",
    displayName: "BLM PPS Sim",
    description: `Estimates DPS based on average potency-per-second, essentially simulating infinite killtime.
Party buffs are not considered.`,
    makeNewSimInstance: function (): BlmPpsSim {
        return new BlmPpsSim();
    },
    loadSavedSimInstance: function (exported: BlmPpsSettingsExternal) {
        return new BlmPpsSim(exported);
    },
    supportedJobs: ['BLM'],
    supportedLevels: [100, 90, 80, 70],
    isDefaultSim: true,
    maintainers: [{
        name: 'Rika',
        contact: [{
            type: 'discord',
            discordTag: 'syntheticglottalstop',
            discordUid: '1111309997482193017',
        }],
    }],
};

// TODO: Replace with xivgear's functions once it's implemented / decided
export function baseDamageFullWithAfUi(stats: ComputedSetStats, potency: number, isDot: boolean = false, afUiMulti: number = 1.0): ValueWithDev {
    const attackType = 'Spell';
    const autoDH = false;

    let spdMulti: number;
    if (isDot) {
        spdMulti = stats.spsDotMulti;
    }
    else {
        spdMulti = 1.0;
    }
    // Multiplier from main stat
    const mainStatMulti = stats.mainStatMulti;

    // Multiplier from weapon damage.
    const wdMulti = stats.wdMulti;

    // Det multiplier
    const detMulti = stats.detMulti;
    // Extra damage from auto DH bonus
    const autoDhBonus = stats.autoDhBonus;
    const tncMulti = stats.tncMulti; // if tank you'd do Funcs.fTEN(stats.tenacity, level) / 1000
    const detAutoDhMulti = flp(3, detMulti + autoDhBonus);
    const traitMulti = stats.traitMulti(attackType);
    const effectiveDetMulti = autoDH ? detAutoDhMulti : detMulti;

    // Base action potency and main stat multi
    // Mahdi:
    // Caster Damage has potency multiplied into weapon damage and then truncated
    // to an integer as opposed to into ap and truncated to 2 decimal.

    // https://github.com/Amarantine-xiv/Amas-FF14-Combat-Sim_source/blob/main/ama_xiv_combat_sim/simulator/calcs/compute_damage_utils.py#L130
    const apDet = flp(2, mainStatMulti * effectiveDetMulti);
    const basePotency = fl(apDet * fl(wdMulti * potency));
    // Factor in Tenacity multiplier
    const afterTnc = fl(basePotency * tncMulti);
    // Factor in sps/sks for dots
    const afterSpd = fl(afterTnc * spdMulti);
    const stage1potency = afterSpd;

    // Factor in trait multiplier
    const afterTrait = fl(stage1potency * traitMulti);
    // Factor in AF/UI multiplier
    const afterAfUi = afterTrait + trunc((afUiMulti - 1.0) * afterTrait);
    // The 1 extra damage if potency is less than 100
    const finalDamage = afterAfUi + ((potency < 100) ? 1 : 0);

    if (finalDamage <= 1) {
        return fixedValue(1);
    }
    else {
        // +-5% damage variance, uniform distribution.
        // Full formula is sqrt((max - min)^2 / 12)
        // === sqrt((1.05d - 0.95d)^2 / 12)
        // === sqrt((.1d)^2 / 12)
        // === sqrt(d^2 * .01 / 12)
        // === d * sqrt(.01 / 12)
        const stdDev = Math.sqrt(0.01 / 12) * finalDamage;
        return {
            expected: finalDamage,
            stdDev: stdDev,
        };
    }
}

function getEnochianModifier(stats: ComputedSetStats): number {
    if (stats.level >= 96) {
        return 1.27;
    }
    else if (stats.level >= 86) {
        return 1.22;
    }
    else if (stats.level >= 78) {
        return 1.15;
    }
    else {
        return 1.10;
    }
}

function dotPotencyToDamage(stats: ComputedSetStats, potency: number): ComputedDamage {
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFullWithAfUi(stats, potency, true);
    const afterCritDh = applyDhCritFull(nonCritDmg, stats, forceCrit, forceDhit);
    return multiplyFixed(afterCritDh, getEnochianModifier(stats));
}

function potencyToDamage(stats: ComputedSetStats, potency: number, afUiMulti: number = 1.0): ComputedDamage {
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFullWithAfUi(stats, potency, false, afUiMulti);
    const afterCritDh = applyDhCritFull(nonCritDmg, stats, forceCrit, forceDhit);
    return multiplyFixed(afterCritDh, getEnochianModifier(stats));;
}

interface PpsPart {
    damage: ComputedDamage,
    value: number,
    time: number,
}

export class BlmPpsSim implements Simulation<BlmPpsResult, BlmPpsSettings, BlmPpsSettingsExternal> {
    spec = blmPpsSpec;
    shortName = 'blm-pps-sim';
    displayName = blmPpsSpec.displayName;
    settings: BlmPpsSettings;

    fastB3damage: ComputedDamage;
    coldB3damage: ComputedDamage;
    B4damage: ComputedDamage;

    fastF3damage: ComputedDamage;
    af1F3damage: ComputedDamage;
    af3F3damage: ComputedDamage;

    ParaDamage: ComputedDamage;
    F4damage: ComputedDamage;
    DespDamage: ComputedDamage;
    FSdamage: ComputedDamage;

    PolyDamage: ComputedDamage;

    ThunderFrontDamage: ComputedDamage;
    ThunderDotDamage: ComputedDamage;

    constructor(settings?: BlmPpsSettingsExternal) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
        }
    }

    makeDefaultSettings(): BlmPpsSettings {
        return {
            useStandardF3P: true,
            spendManafontF3P: false,
            useColdB3: true,
            stdDevs: 0,
        };
    }

    exportSettings(): BlmPpsSettingsExternal {
        return {
            customSettings: this.settings,
        };
    }

    settingsChanged() {
    }

    private precomputeDamage(stats: ComputedSetStats) {
        this.fastB3damage = potencyToDamage(stats, Actions.Blizzard3.potency, el3Penalty);
        this.coldB3damage = potencyToDamage(stats, Actions.Blizzard3.potency);
        this.B4damage = potencyToDamage(stats, Actions.Blizzard4.potency);
        this.fastF3damage = potencyToDamage(stats, Actions.Fire3.potency, el3Penalty);
        this.af1F3damage = potencyToDamage(stats, Actions.Fire3.potency, af1Mult);
        this.af3F3damage = potencyToDamage(stats, Actions.Fire3.potency, af3Mult);
        this.ParaDamage = potencyToDamage(stats, Actions.FireParadox.potency);
        this.F4damage = potencyToDamage(stats, Actions.Fire4.potency, af3Mult);
        this.DespDamage = potencyToDamage(stats, Actions.Despair.potency, af3Mult);
        this.FSdamage = potencyToDamage(stats, Actions.FlareStar.potency, af3Mult);

        const XenoFoul = stats.level >= 80 ? Actions.Xenoglossy : Actions.Foul;
        this.PolyDamage = potencyToDamage(stats, XenoFoul.potency);

        const Thunder = (stats.level >= 90 ? Actions.HighThunder : Actions.Thunder3) as DamagingAbility;
        this.ThunderFrontDamage = potencyToDamage(stats, Thunder.potency);
        this.ThunderDotDamage = dotPotencyToDamage(stats, Thunder.dot.tickPotency);
    }

    polyglot(stats: ComputedSetStats, rotationLength: number): PpsPart {
        const rotScalar = rotationLength / 30;
        const potency = stats.level >= 80 ? Xeno : Foul;

        return {
            damage: multiplyFixed(this.PolyDamage, rotScalar),
            value: potency * rotScalar,
            time: stats.gcdMag(2.5) * rotScalar,
        };
    }

    // Scale Manafont since our cycles are longer than 120s
    manafont(stats: ComputedSetStats, rotationLength: number): PpsPart {
        let damage: ComputedDamage;
        let value: number;
        let numGcds: number;
        let cooldown: number;

        switch (stats.level) {
            case 100:
                cooldown = 100;
                numGcds = 9;
                value = Para + 6 * F4 + Desp + FS;
                damage = addValues(
                    this.ParaDamage,
                    // 6xF4
                    multiplyIndependent(this.F4damage, 6),
                    this.DespDamage,
                    this.FSdamage
                );
                break;
            case 90:
                cooldown = 100;
                numGcds = 8;
                value = Para + 6 * F4 + Desp;
                damage = addValues(
                    this.ParaDamage,
                    // 6xF4
                    multiplyIndependent(this.F4damage, 6),
                    this.DespDamage
                );
                break;
            case 80:
                cooldown = 120;
                numGcds = 8;
                value = 7 * F4 + Desp;
                damage = addValues(
                    // 7xF4
                    multiplyIndependent(this.F4damage, 7),
                    this.DespDamage
                );
                break;
            case 70:
                cooldown = 120;
                numGcds = 7;
                value = 7 * F4;
                damage = multiplyIndependent(this.F4damage, 7);
                break;
        }
        if (stats.level >= 90 && this.settings.spendManafontF3P) {
            numGcds += 1;
            value += af3F3P;
            damage = addValues(damage, this.af3F3damage);
        }

        const rotScalar = rotationLength / cooldown;

        return {
            damage: multiplyFixed(damage, rotScalar),
            value: value * rotScalar,
            time: numGcds * stats.gcdMag(2.5) * LLscalar * rotScalar,
        };
    }

    amplifier(stats: ComputedSetStats, rotationLength: number): PpsPart {
        const rotScalar = rotationLength / 120;

        return {
            damage: multiplyFixed(this.PolyDamage, rotScalar),
            value: Xeno * rotScalar,
            time: stats.gcdMag(2.5) * LLscalar * rotScalar,
        };
    }

    thunder(stats: ComputedSetStats, rotationLength: number): PpsPart {
        const frontValue = (stats.level <= 90 ? T3 : HT);
        const tickValue = (stats.level <= 90 ? T3dot : HTdot);
        const dotDuration = (stats.level <= 90 ? T3dur : HTdur);
        const numTicks = (stats.level <= 90 ? T3ticks : HTticks);

        const rotScalar = rotationLength / dotDuration;

        const upfrontDamage = this.ThunderFrontDamage;
        const tickDamage = this.ThunderDotDamage;

        return {
            damage: addValues(upfrontDamage, multiplyIndependent(tickDamage, numTicks)),
            value: (frontValue + numTicks * stats.spsDotMulti * tickValue) * rotScalar,
            time: stats.gcdMag(2.5) * LLscalar * rotScalar,
        };
    }

    getCycle(stats: ComputedSetStats): PpsPart {
        // A normal rotation is:
        // 100: B3 B4 Para F3 Para 6xF4 Desp FS
        // 90: B3 B4 Para F3 Para 6xF4 Desp
        // 80: B3 B4 F3 7xF4 Desp
        // 70: B3 B4 F3 7xF4

        let damage = addValues(
            this.B4damage,
            // 5xF4
            multiplyIndependent(this.F4damage, 5)
        );
        let value = B4 + 5 * F4;
        let numGcds = 6;

        // lv>=90 has 6xF4 so one more. lv<=80 has 7xF4 so two more, but special case for cold B3 at lv80.
        if (stats.level >= 90) {
            damage = addValues(damage, this.F4damage);
            value += F4;
            numGcds += 1;
        }
        if (stats.level === 70 || (stats.level === 80 && !this.settings.useColdB3)) {
            damage = addValues(damage, multiplyIndependent(this.F4damage, 2));
            value += 2 * F4;
            numGcds += 2;
        }

        // standard AF1 F3P if lv>=90. special case for cold B3 at lv80.
        if (stats.level >= 90 && this.settings.useStandardF3P) {
            damage = addValues(damage, this.af1F3damage);
            value += hotF3;
            numGcds += 1;
        }
        else if (stats.level === 70 || (stats.level === 80 && !this.settings.useColdB3)
                            || (stats.level >= 90 && !this.settings.useStandardF3P)) {
            damage = addValues(damage, this.fastF3damage);
            value += fastF3;
            numGcds += 1;
        }

        if (stats.level >= 80) {
            damage = addValues(damage, this.DespDamage);
            value += Desp;
            numGcds += 1;
        }

        if (stats.level >= 90) {
            damage = addValues(damage, multiplyIndependent(this.ParaDamage, 2));
            value += 2 * Para;
            numGcds += 2;
        }

        if (stats.level >= 100) {
            damage = addValues(damage, this.FSdamage);
            value += FS;
            numGcds += 1;
        }

        // just fast B3 if it is turned off (or level 70)
        if (!this.settings.useColdB3 || stats.level === 70) {
            damage = addValues(damage, this.fastB3damage);
            value += fastB3;
            numGcds += 1;
        }

        damage = multiplyIndependent(damage, numF4Rots);
        value *= numF4Rots;
        numGcds *= numF4Rots;

        // cold B3, reasonings thanks to punished downtime (solver uptime, great name btw lol)
        if (this.settings.useColdB3) {
            if (stats.level >= 90) {
                // levels 90 and 100: assume we get 3 instant UI1 B3 per cycle.
                // - two triplecast charges per 2 min to spend on cold B3.
                // - one swiftcast per 2 min spent on cold B3,
                //   it can be used twice on high speed but it will drift so consider it unreliable

                // 3 ui1 b3
                damage = addValues(damage, multiplyIndependent(this.coldB3damage, 3));
                value += 3 * coldB3;
                numGcds += 3;

                // rest is af b3
                if (numF4Rots - 3 > 0) {
                    damage = addValues(damage, multiplyIndependent(this.fastB3damage, numF4Rots - 3));
                    value += fastB3 * (numF4Rots - 3);
                    numGcds += (numF4Rots - 3);
                }
            }
            else if (stats.level === 80) {
                // level 80: assume we get 2 instant UI1 B3 per cycle.
                // - we can also spend 1 triplecast on B3 B4 F3 including hot F3.
                //   it could be considered twice but that might be too aggressive.

                // 2 ui1 b3
                damage = addValues(damage, multiplyIndependent(this.coldB3damage, 2));
                value += 2 * coldB3;
                numGcds += 2;

                // rest is af b3
                if (numF4Rots - 2 > 0) {
                    damage = addValues(damage, multiplyIndependent(this.fastB3damage, numF4Rots - 2));
                    value += fastB3 * (numF4Rots - 2);
                    numGcds += (numF4Rots - 2);
                }

                // one af1 f3 per cycle, every other F4Rot has 2 more f4.
                damage = addValues(damage, this.af1F3damage);
                value += hotF3;
                numGcds += 1;
                if (numF4Rots - 1 > 0) {
                    damage = addValues(damage, multiplyIndependent(this.F4damage, (numF4Rots - 1) * 2));
                    value += 2 * F4 * (numF4Rots - 1);
                    numGcds += 2 * (numF4Rots - 1);
                }
            }
        }

        //console.log(numGcds, "gcds per cycle");

        return {
            damage,
            value,
            time: numGcds * stats.gcdMag(2.5) * LLscalar,
        };
    }


    async simulate(set: CharacterGearSet): Promise<BlmPpsResult> {
        const stats = set.computedStats;

        //console.log("---");

        this.precomputeDamage(stats);

        const zero = {damage: fixedValue(0), value: 0, time: 0};

        const cycle = this.getCycle(stats);
        const xeno = this.polyglot(stats, cycle.time);
        const mf = this.manafont(stats, cycle.time);
        const amply = stats.level >= 90 ? this.amplifier(stats, cycle.time) : zero;
        const thunder = this.thunder(stats, cycle.time);

        const damage = addValues(cycle.damage, xeno.damage, mf.damage, amply.damage, thunder.damage);
        const potency = cycle.value + xeno.value + mf.value + amply.value + thunder.value;
        const time = cycle.time + xeno.time + mf.time + amply.time + thunder.time;

        //const damage = cycle.damage;
        //const potency = cycle.value;
        //const time = cycle.time;

        const enochian = getEnochianModifier(stats);

        const dps = multiplyFixed(damage, 1.0 / time);
        const pps = potency / time;

        /*
        const w = (d: PpsPart) => {
            return {
                damage: d.damage.expected,
                time: d.time,
            };
        };

        console.log({
            cycle: w(cycle),
            xeno: w(xeno),
            mf: w(mf),
            amply: w(amply),
            thunder: w(thunder),
        });
        console.log({
            fastB3: this.fastB3damage.expected,
            coldB3: this.coldB3damage.expected,
            B4: this.B4damage.expected,

            fastF3: this.fastF3damage.expected,
            af1F3: this.af1F3damage.expected,
            af3F3: this.af3F3damage.expected,

            paradox: this.ParaDamage.expected,
            F4: this.F4damage.expected,
            despair: this.DespDamage.expected,
            FS: this.FSdamage.expected,

            xenoFoul: this.PolyDamage.expected,

            thunderFront:this.ThunderFrontDamage.expected,
            thunderDot: this.ThunderDotDamage.expected,
        });
        console.log("time:", time);
        console.log("total damage:", damage.expected);
        console.log("dps:", damage.expected / time);
        */

        return {
            mainDpsResult: applyStdDev(dps, this.settings.stdDevs ?? 0),
            mainDpsFull: dps,
            pps: pps,
            ppsWithEno: pps * enochian,
        };
    }

    async simulateSimple(set: CharacterGearSet): Promise<number> {
        return (await this.simulate(set)).mainDpsResult;
    }

}
