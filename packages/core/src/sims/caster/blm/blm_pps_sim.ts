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
import {addValues, multiplyFixed, multiplyIndependent, fixedValue, ValueWithDev} from "@xivgear/xivmath/deviation";
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
const HTticks = 10;
const T3 = Actions.Thunder3.potency;
const T3dot = (Actions.Thunder3 as DamagingAbility).dot.tickPotency;
const T3dur = (Actions.Thunder3 as DamagingAbility).dot.duration as number;
const T3ticks = 9;
const FS = af3Mult * Actions.FlareStar.potency;

const LLscalar = 120 / ((20 / 0.85) + 100);
const numF4Rots = 4;

export interface BlmPpsResult extends SimResult {
    mainDpsFull: ValueWithDev,
    pps: number,
}

export interface BlmPpsSettings extends SimSettings {
    useStandardF3P: boolean,
    spendManafontF3P: boolean,
    useColdB3: boolean,
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
        };
    }

    exportSettings(): BlmPpsSettingsExternal {
        return {
            customSettings: this.settings,
        };
    }

    settingsChanged() {
    }

    xenoValue(rotationLength: number): number {
        return Xeno * (rotationLength / 30);
    }

    foulValue(rotationLength: number): number {
        return Foul * (rotationLength / 30);
    }

    polyglotValue(stats: ComputedSetStats, rotationLength: number) {
        return stats.level >= 80 ? this.xenoValue(rotationLength) : this.foulValue(rotationLength);
    }

    polyglotTime(stats: ComputedSetStats, rotationLength: number): number {
        return stats.gcdMag(2.5) * (rotationLength / 30);
    }

    polyglotDamage(stats: ComputedSetStats, rotationLength: number): ComputedDamage {
        const potency = stats.level >= 80 ? Xeno : Foul;
        const damage = potencyToDamage(stats, potency);
        return multiplyFixed(damage, rotationLength / 30);
    }

    // Scale Manafont since our cycles are longer than 120s
    manafontValue(stats: ComputedSetStats, rotationLength: number): number {
        let value: number;
        let cooldown: number;
        switch (stats.level) {
            case 100:
                value = Para + 6 * F4 + Desp + FS;
                cooldown = 100;
                break;
            case 90:
                value = Para + 6 * F4 + Desp;
                cooldown = 100;
                break;
            case 80:
                value = 7 * F4 + Desp;
                cooldown = 120;
                break;
            case 70:
                value = 7 * F4;
                cooldown = 120;
                break;
        }
        if (stats.level >= 90 && this.settings.spendManafontF3P) {
            value += af3F3P;
        }
        return value * (rotationLength / cooldown);
    }

    manafontTime(stats: ComputedSetStats, rotationLength: number): number {
        let numGcds: number;
        let cooldown: number;
        switch (stats.level) {
            case 100:
                numGcds = 9;
                cooldown = 100;
                break;
            case 90:
                numGcds = 8;
                cooldown = 100;
                break;
            case 80:
                numGcds = 8;
                cooldown = 120;
                break;
            case 70:
                numGcds = 7;
                cooldown = 120;
                break;
        }
        if (stats.level >= 90 && this.settings.spendManafontF3P) {
            numGcds += 1;
        }
        return numGcds * stats.gcdMag(2.5) * LLscalar * (rotationLength / cooldown);
    }

    manafontDamage(stats: ComputedSetStats, rotationLength: number): ComputedDamage {
        let value: ComputedDamage;
        let cooldown: number;
        const F4damage = potencyToDamage(stats, F4);
        switch (stats.level) {
            case 100:
                value = addValues(
                    potencyToDamage(stats, Para),
                    // 6xF4
                    multiplyIndependent(F4damage, 6),
                    potencyToDamage(stats, Desp),
                    potencyToDamage(stats, FS)
                );
                cooldown = 100;
                break;
            case 90:
                value = addValues(
                    potencyToDamage(stats, Para),
                    // 6xF4
                    multiplyIndependent(F4damage, 6),
                    potencyToDamage(stats, Desp)
                );
                cooldown = 100;
                break;
            case 80:
                value = addValues(
                    // 7xF4
                    multiplyIndependent(F4damage, 7),
                    potencyToDamage(stats, Desp)
                );
                cooldown = 120;
                break;
            case 70:
                // 7xF4
                value = multiplyIndependent(F4damage, 7);
                cooldown = 120;
                break;
        }
        if (stats.level >= 90 && this.settings.spendManafontF3P) {
            value = addValues(value, potencyToDamage(stats, af3F3P));
        }
        return multiplyFixed(value, rotationLength / cooldown);
    }

    amplifierValue(rotationLength: number): number {
        return Xeno * (rotationLength / 120);
    }

    amplifierTime(stats: ComputedSetStats, rotationLength: number): number {
        return stats.gcdMag(2.5) * LLscalar * (rotationLength / 120);
    }

    amplifierDamage(stats: ComputedSetStats, rotationLength: number): ComputedDamage {
        return multiplyFixed(potencyToDamage(stats, Xeno), rotationLength / 120);
    }

    thunderValue(stats: ComputedSetStats, rotationLength: number): number {
        const frontValue = (stats.level <= 90 ? T3 : HT);
        const tickValue = (stats.level <= 90 ? T3dot : HTdot);
        const dotDuration = (stats.level <= 90 ? T3dur : HTdur);
        const numTicks = (stats.level <= 90 ? T3ticks : HTticks);
        return (frontValue + numTicks * stats.spsDotMulti * tickValue) * (rotationLength / dotDuration);
    }

    thunderTime(stats: ComputedSetStats, rotationLength: number): number {
        const tickDuration = (stats.level <= 90 ? T3dur : HTdur);
        return stats.gcdMag(2.5) * LLscalar * (rotationLength / tickDuration);
    }

    thunderDamage(stats: ComputedSetStats, rotationLength: number): ComputedDamage {
        const frontValue = (stats.level <= 90 ? T3 : HT);
        const tickValue = (stats.level <= 90 ? T3dot : HTdot);
        const dotDuration = (stats.level <= 90 ? T3dur : HTdur);
        const numTicks = (stats.level <= 90 ? T3ticks : HTticks);

        const upfrontDamage = potencyToDamage(stats, frontValue);
        const tickDamage = dotPotencyToDamage(stats, tickValue);

        const dotDamage = addValues(
            upfrontDamage,
            multiplyIndependent(tickDamage, numTicks)
        );
        return multiplyFixed(dotDamage, rotationLength / dotDuration);
    }

    getCycleDamage(stats: ComputedSetStats): ComputedDamage {
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

        // lv>=90 has 6xF4 so one more. lv<=80 has 7xF4 so two more, but special case for cold B3 at lv80.
        if (stats.level === 90) {
            damage = addValues(damage, F4damage);
        }
        if (stats.level === 70 || (stats.level === 80 && !this.settings.useColdB3)) {
            damage = addValues(damage, multiplyIndependent(F4damage, 2));
        }

        // standard AF1 F3P if lv>=90. special case for cold B3 at lv80.
        if (stats.level >= 90 && this.settings.useStandardF3P) {
            damage = addValues(damage, hotF3damage);
        }
        else if (stats.level === 70 || (stats.level === 80 && !this.settings.useColdB3)) {
            damage = addValues(damage, fastF3damage);
        }

        if (stats.level >= 80) {
            damage = addValues(damage, DespDamage);
        }

        if (stats.level >= 90) {
            damage = addValues(damage, multiplyIndependent(ParaDamage, 2));
        }

        if (stats.level >= 100) {
            damage = addValues(damage, FSdamage);
        }

        // just fast B3 if it is turned off (or level 70)
        if (!this.settings.useColdB3 || stats.level === 70) {
            damage = addValues(damage, fastB3damage);
        }

        damage = multiplyIndependent(damage, numF4Rots);

        // check getCyclePotency for logic
        if (this.settings.useColdB3) {
            if (stats.level >= 90) {
                // three UI1 B3 per cycle
                damage = addValues(damage, multiplyIndependent(coldB3damage, 3));
                if (numF4Rots - 3 > 0) {
                    damage = addValues(damage, multiplyIndependent(fastB3damage, numF4Rots - 3));
                }
            }
            else if (stats.level === 80) {
                // two UI1 B3 per cycle
                damage = addValues(damage, multiplyIndependent(coldB3damage, 2));
                if (numF4Rots - 2 > 0) {
                    damage = addValues(damage, multiplyIndependent(fastB3damage, numF4Rots - 2));
                }
                // one AF1 F3 per cycle, every other F4Rot has 2 more F4.
                damage = addValues(damage, hotF3damage);
                if (numF4Rots - 1 > 0) {
                    damage = addValues(damage, multiplyIndependent(F4damage, (numF4Rots - 1) * 2));
                }
            }
        }

        return damage;
    }

    getCyclePotency(stats: ComputedSetStats): number {
        // A normal rotation is:
        // 100: B3 B4 Para F3 Para 6xF4 Desp FS
        // 90: B3 B4 Para F3 Para 6xF4 Desp
        // 80: B3 B4 F3 7xF4 Desp
        // 70: B3 B4 F3 7xF4

        let F4Rotation = fastB3 + B4;

        F4Rotation += 6 * F4;

        if (stats.level >= 90) {
            F4Rotation += 2 * Para;
        }
        else {
            F4Rotation += F4;
        }

        if (stats.level >= 80) {
            F4Rotation += Desp;
        }

        if (stats.level >= 100) {
            F4Rotation += FS;
        }

        // standard AF1 F3P if lv>=90
        if (stats.level >= 90) {
            if (this.settings.useStandardF3P) {
                F4Rotation += hotF3; // AF1 F3P.
            }
            else {
                F4Rotation += fastF3; // cold F3.
            }
        }
        else if (this.settings.useStandardF3P) {
            console.log("[BLM PPS Sim] Ignoring the standard F3P setting at level 80 and below.");
            F4Rotation += fastF3;
        }

        let value = numF4Rots * F4Rotation;

        // cold B3, reasonings thanks to punished downtime
        if (this.settings.useColdB3) {
            if (stats.level >= 90) {
                // levels 90 and 100: assume we get 3 instant UI1 B3 per cycle.
                // - two triplecast charges per 2 min to spend on cold B3.
                // - one swiftcast per 2 min spent on cold B3,
                //   it can be used twice on high speed but it will drift so consider it unreliable
                value += numF4Rots * (coldB3 - fastB3) * 3; // gain from making 3 ui1 b3 instant casts.
            }
            else if (stats.level === 80) {
                // level 80: assume we get 2 instant UI1 B3 per cycle.
                // - we can also spend 1 triplecast on B3 B4 F3 including hot F3.
                //   it could be considered twice but that might be too aggressive.
                value += numF4Rots * (coldB3 - fastB3); // gain from making 1 ui1 b3 instant cast.
                // gain from using triplecast on B3 B4 F3.
                value += numF4Rots * (coldB3 + hotF3 - (fastB3 + fastF3 + 2 * F4));
            }
            else {
                console.log("[BLM PPS Sim] Ignoring the cold B3 setting at level 70.");
            }
        }

        return value;
    }

    getCycleTime(stats: ComputedSetStats): number {
        // A normal rotation is:
        // 100: B3 B4 Para F3 Para 6xF4 Desp FS
        // 90: B3 B4 Para F3 Para 6xF4 Desp
        // 80: B3 B4 F3 7xF4 Desp
        // 70: B3 B4 F3 7xF4

        const shortGcd = stats.gcdMag(2.5);

        // B3 B4 F3 6xF4 (F4/Para)
        let result = 10 * shortGcd;

        // Despair
        if (stats.level >= 80) {
            result += shortGcd;
        }
        // Ice Para
        if (stats.level >= 90) {
            result += shortGcd;
        }
        // Flare Star
        if (stats.level >= 100) {
            result += shortGcd;
        }

        // At level 80, with cold B3 enabled, we skip 2xF4 once per cycle.
        if (stats.level === 80 && this.settings.useColdB3) {
            result -= 2 * shortGcd;
        }

        result *= numF4Rots;

        result *= LLscalar;

        return result;
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

        const cycle = this.getCycleTime(stats);
        const xenoT = this.polyglotTime(stats, cycle);
        const xenoP = this.polyglotValue(stats, cycle);
        const xenoD = this.polyglotDamage(stats, cycle);
        const mfT = this.manafontTime(stats, cycle);
        const mfP = this.manafontValue(stats, cycle);
        const mfD = this.manafontDamage(stats, cycle);
        const amplyT = stats.level >= 90 ? this.amplifierTime(stats, cycle) : 0;
        const amplyP = stats.level >= 90 ? this.amplifierValue(cycle) : 0;
        const amplyD = stats.level >= 90 ? this.amplifierDamage(stats, cycle) : fixedValue(0);
        const thunderT = this.thunderTime(stats, cycle);
        const thunderP = this.thunderValue(stats, cycle);
        const thunderD = this.thunderDamage(stats, cycle);

        const cycleP = this.getCyclePotency(stats);
        const cycleD = this.getCycleDamage(stats);

        const potency = cycleP + xenoP + mfP + amplyP + thunderP;
        const time = cycle + xenoT + mfT + amplyT + thunderT;
        const damage = addValues(cycleD, xenoD, mfD, amplyD, thunderD);

        //console.log({cycle, xenoT, xenoP, mfT, mfP, amplyT, amplyP, thunderT, thunderP, cycleP, potency, time});

        //console.log("Rotation PPS: " + potency / time);

        const enochian = this.getEnochianModifier(stats);

        //const damage = potencyToDamage(stats, potency);
        const dps = multiplyFixed(damage, enochian / time);
        const pps = potency / time;

        return {
            mainDpsResult: dps.expected,
            mainDpsFull: dps,
            pps: pps,
        };
    }

    async simulateSimple(set: CharacterGearSet): Promise<number> {
        return (await this.simulate(set)).mainDpsResult;
    }

}
