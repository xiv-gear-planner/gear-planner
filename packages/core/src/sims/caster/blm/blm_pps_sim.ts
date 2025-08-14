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
import {multiplyFixed, ValueWithDev} from "@xivgear/xivmath/deviation";
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
const af3Mult = 1.8;

const fastF3 = el3Penalty * Actions.Fire3.potency;
const fastB3 = el3Penalty * Actions.Blizzard3.potency;
const B3 = Actions.Blizzard3.potency;
const B4 = Actions.Blizzard4.potency;
const Xeno = Actions.Xenoglossy.potency;
const Foul = Actions.Foul.potency;
const F3P = af3Mult * Actions.Fire3.potency;
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
    useF3P: boolean,
    spendManafontF3P: boolean,
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

function potencyToDamage(stats: ComputedSetStats, potency: number): ComputedDamage {
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFull(stats, potency, "Spell", forceDhit, false, getDefaultScalings(stats));
    const afterCritDh = applyDhCritFull(nonCritDmg, stats, forceCrit, forceDhit);
    return afterCritDh;
}

export class BlmPpsSim implements Simulation<BlmPpsResult, BlmPpsSettings, BlmPpsSettingsExternal> {
    spec = blmPpsSpec;
    shortName = 'blm-pps-sim';
    displayName = blmPpsSpec.displayName;
    settings: BlmPpsSettings;

    constructor(settings?: BlmPpsSettingsExternal) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
        }
    }

    makeDefaultSettings(): BlmPpsSettings {
        return {
            useF3P: true,
            spendManafontF3P: false,
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
            value += F3P;
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

    amplifierValue(rotationLength: number): number {
        return Xeno * (rotationLength / 120);
    }

    amplifierTime(stats: ComputedSetStats, rotationLength: number): number {
        return stats.gcdMag(2.5) * LLscalar * (rotationLength / 120);
    }

    thunderValue(stats: ComputedSetStats, rotationLength: number): number {
        const frontValue = (stats.level <= 90 ? T3 : HT);
        const tickValue = (stats.level <= 90 ? T3dot : HTdot);
        const tickDuration = (stats.level <= 90 ? T3dur : HTdur);
        const numTicks = (stats.level <= 90 ? T3ticks : HTticks);
        return (frontValue + numTicks * stats.spsDotMulti * tickValue) * (rotationLength / tickDuration);
    }

    thunderTime(stats: ComputedSetStats, rotationLength: number): number {
        const tickDuration = (stats.level <= 90 ? T3dur : HTdur);
        return stats.gcdMag(2.5) * LLscalar * (rotationLength / tickDuration);
    }

    getCyclePotency(stats: ComputedSetStats): number {
        // A normal rotation is:
        // 100: B3 B4 Para F3 Para 6xF4 Desp FS
        // 90: B3 B4 Para F3 Para 6xF4 Desp
        // 80: B3 B4 F3 7xF4 Desp
        // 70: B3 B4 F3 7xF4

        let F4Rotation = B3 + B4;

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

        // F3P if lv>=90 and F3P enabled.
        if (stats.level >= 90 && this.settings.useF3P) {
            F4Rotation += F3P;
        }
        else {
            F4Rotation += fastF3;
        }

        return numF4Rots * (F4Rotation + fastB3);
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
        const mfT = this.manafontTime(stats, cycle);
        const mfP = this.manafontValue(stats, cycle);
        const amplyT = stats.level >= 90 ? this.amplifierTime(stats, cycle) : 0;
        const amplyP = stats.level >= 90 ? this.amplifierValue(cycle) : 0;
        const thunderT = this.thunderTime(stats, cycle);
        const thunderP = this.thunderValue(stats, cycle);

        const cycleP = this.getCyclePotency(stats);

        const potency = cycleP + xenoP + mfP + amplyP + thunderP;
        const time = cycle + xenoT + mfT + amplyT + thunderT;

        //console.log({cycle, xenoT, xenoP, mfT, mfP, amplyT, amplyP, thunderT, thunderP, cycleP, potency, time});

        //console.log("Rotation PPS: " + potency / time);

        const enochian = this.getEnochianModifier(stats);

        const damage = potencyToDamage(stats, enochian * potency);
        const dps = multiplyFixed(damage, 1.0 / time);
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
