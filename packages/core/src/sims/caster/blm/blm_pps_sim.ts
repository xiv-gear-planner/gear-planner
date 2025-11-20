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
    applyDhCritFull,
    baseDamageFull,
    getDefaultScalings
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
    description: `Estimates DPS based on average potency-per-second, essentially simulating infinite killtime.`,
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

function dotPotencyToDamage(stats: ComputedSetStats, potency: number): ComputedDamage {
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFull(stats, potency, 'Spell', forceDhit, true, getDefaultScalings(stats));
    const afterCritDh = applyDhCritFull(nonCritDmg, stats, forceCrit, forceDhit);
    return afterCritDh;
}

function potencyToDamage(stats: ComputedSetStats, potency: number): ComputedDamage {
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFull(stats, potency, 'Spell', forceDhit, false, getDefaultScalings(stats));
    const afterCritDh = applyDhCritFull(nonCritDmg, stats, forceCrit, forceDhit);
    return afterCritDh;
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

    damage: ComputedDamage[];

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

    polyglot(stats: ComputedSetStats, rotationLength: number): PpsPart {
        const rotScalar = rotationLength / 30;
        const potency = stats.level >= 80 ? Xeno : Foul;

        return {
            damage: multiplyFixed(potencyToDamage(stats, potency), rotScalar),
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

        const F4damage = potencyToDamage(stats, F4);

        switch (stats.level) {
            case 100:
                cooldown = 100;
                numGcds = 9;
                value = Para + 6 * F4 + Desp + FS;
                damage = addValues(
                    potencyToDamage(stats, Para),
                    // 6xF4
                    multiplyIndependent(F4damage, 6),
                    potencyToDamage(stats, Desp),
                    potencyToDamage(stats, FS)
                );
                break;
            case 90:
                cooldown = 100;
                numGcds = 8;
                value = Para + 6 * F4 + Desp;
                damage = addValues(
                    potencyToDamage(stats, Para),
                    // 6xF4
                    multiplyIndependent(F4damage, 6),
                    potencyToDamage(stats, Desp)
                );
                break;
            case 80:
                cooldown = 120;
                numGcds = 8;
                value = 7 * F4 + Desp;
                damage = addValues(
                    // 7xF4
                    multiplyIndependent(F4damage, 7),
                    potencyToDamage(stats, Desp)
                );
                break;
            case 70:
                cooldown = 120;
                numGcds = 7;
                value = 7 * F4;
                damage = multiplyIndependent(F4damage, 7);
                break;
        }
        if (stats.level >= 90 && this.settings.spendManafontF3P) {
            numGcds += 1;
            value += af3F3P;
            damage = addValues(damage, potencyToDamage(stats, af3F3P));
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
            damage: multiplyFixed(potencyToDamage(stats, Xeno), rotScalar),
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

        const upfrontDamage = potencyToDamage(stats, frontValue);
        const tickDamage = dotPotencyToDamage(stats, tickValue);

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

        const fastB3damage = potencyToDamage(stats, fastB3);
        const coldB3damage = potencyToDamage(stats, coldB3);
        const B4damage = potencyToDamage(stats, B4);

        const fastF3damage = potencyToDamage(stats, fastF3);
        const hotF3damage = potencyToDamage(stats, hotF3);
        const F4damage = potencyToDamage(stats, F4);
        const DespDamage = potencyToDamage(stats, Desp);
        const FSdamage = potencyToDamage(stats, FS);

        const ParaDamage = potencyToDamage(stats, Para);

        let damage = addValues(
            B4damage,
            // 5xF4
            multiplyIndependent(F4damage, 5)
        );
        let value = B4 + 5 * F4;
        let numGcds = 6;

        // lv>=90 has 6xF4 so one more. lv<=80 has 7xF4 so two more, but special case for cold B3 at lv80.
        if (stats.level === 90) {
            damage = addValues(damage, F4damage);
            value += F4;
            numGcds += 1;
        }
        if (stats.level === 70 || (stats.level === 80 && !this.settings.useColdB3)) {
            damage = addValues(damage, multiplyIndependent(F4damage, 2));
            value += 2 * F4;
            numGcds += 2;
        }

        // standard AF1 F3P if lv>=90. special case for cold B3 at lv80.
        if (stats.level >= 90 && this.settings.useStandardF3P) {
            damage = addValues(damage, hotF3damage);
            value += hotF3;
            numGcds += 1;
        }
        else if (stats.level === 70 || (stats.level === 80 && !this.settings.useColdB3)) {
            damage = addValues(damage, fastF3damage);
            value += fastF3;
            numGcds += 1;
        }

        if (stats.level >= 80) {
            damage = addValues(damage, DespDamage);
            value += Desp;
            numGcds += 1;
        }

        if (stats.level >= 90) {
            damage = addValues(damage, multiplyIndependent(ParaDamage, 2));
            value += 2 * Para;
            numGcds += 2;
        }

        if (stats.level >= 100) {
            damage = addValues(damage, FSdamage);
            value += FS;
            numGcds += 1;
        }

        // just fast B3 if it is turned off (or level 70)
        if (!this.settings.useColdB3 || stats.level === 70) {
            damage = addValues(damage, fastB3damage);
            value += fastB3;
            numGcds += 1;
        }

        damage = multiplyIndependent(damage, numF4Rots);
        value *= numF4Rots;
        numGcds *= numF4Rots;

        // cold B3, reasonings thanks to punished downtime
        if (this.settings.useColdB3) {
            if (stats.level >= 90) {
                // levels 90 and 100: assume we get 3 instant UI1 B3 per cycle.
                // - two triplecast charges per 2 min to spend on cold B3.
                // - one swiftcast per 2 min spent on cold B3,
                //   it can be used twice on high speed but it will drift so consider it unreliable

                // 3 ui1 b3
                damage = addValues(damage, multiplyIndependent(coldB3damage, 3));
                value += 3 * coldB3;
                numGcds += 3;

                // rest is af b3
                if (numF4Rots - 3 > 0) {
                    damage = addValues(damage, multiplyIndependent(fastB3damage, numF4Rots - 3));
                    value += fastB3 * (numF4Rots - 3);
                    numGcds += (numF4Rots - 3);
                }
            }
            else if (stats.level === 80) {
                // level 80: assume we get 2 instant UI1 B3 per cycle.
                // - we can also spend 1 triplecast on B3 B4 F3 including hot F3.
                //   it could be considered twice but that might be too aggressive.

                // 2 ui1 b3
                damage = addValues(damage, multiplyIndependent(coldB3damage, 2));
                value += 2 * coldB3;
                numGcds += 2;

                // rest is af b3
                if (numF4Rots - 2 > 0) {
                    damage = addValues(damage, multiplyIndependent(fastB3damage, numF4Rots - 2));
                    value += fastB3 * (numF4Rots - 2);
                    numGcds += (numF4Rots - 2);
                }

                // one af1 f3 per cycle, every other F4Rot has 2 more f4.
                damage = addValues(damage, hotF3damage);
                value += hotF3;
                numGcds += 1;
                if (numF4Rots - 1 > 0) {
                    damage = addValues(damage, multiplyIndependent(F4damage, (numF4Rots - 1) * 2));
                    value += 2 * F4 * (numF4Rots - 1);
                    numGcds += 2 * (numF4Rots - 1);
                }
            }
        }

        return {
            damage,
            value,
            time: numGcds * stats.gcdMag(2.5) * LLscalar,
        };
    }

    getEnochianModifier(stats: ComputedSetStats): number {
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

    async simulate(set: CharacterGearSet): Promise<BlmPpsResult> {
        const stats = set.computedStats;

        const zero = {damage: fixedValue(0), value: 0, time: 0};

        const cycle = this.getCycle(stats);
        const xeno = this.polyglot(stats, cycle.time);
        const mf = this.manafont(stats, cycle.time);
        const amply = stats.level >= 90 ? this.amplifier(stats, cycle.time) : zero;
        const thunder = this.thunder(stats, cycle.time);

        const damage = addValues(cycle.damage, xeno.damage, mf.damage, amply.damage, thunder.damage);
        const potency = cycle.value + xeno.value + mf.value + amply.value + thunder.value;
        const time = cycle.time + xeno.time + mf.time + amply.time + thunder.time;

        /*
        console.log({cycle, xeno, mf, amply, thunder, damage, potency, time});
        console.log("Rotation PPS: " + potency / time);
        */

        const enochian = this.getEnochianModifier(stats);

        const dps = multiplyFixed(damage, enochian / time);
        const pps = potency / time;

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
