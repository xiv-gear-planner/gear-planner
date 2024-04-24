import {SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {applyCrit, applyDhCrit, baseDamage, baseHealing} from "xivmath/xivmath";
import {ComputedSetStats} from "../../../../xivmath/src/geartypes";
import {
    FieldBoundCheckBox,
    FieldBoundFloatField,
    labeledCheckbox, labelFor,
    positiveValuesOnly, quickElement
} from "../components/util";


//potencies for our spells

const glare = 310
const dia = 65
const diaDot = 65
const assize = 400
const misery = 1240
const battleVoiceAvg = (15 / 120) * 0.2;
const battleLitanyAvg = (15 / 120) * 0.1;
const chainStratAvg = (15 / 120) * 0.1;
const devilmentAvg = (20 / 120) * 0.2;
const brdCritAvg = (45 / 120) * 0.02;
const brdDhAvg = (45 / 120) * 0.03;
const fl = Math.floor;


export interface WhmSheetSimResult extends SimResult {
    pps: number,
    mpUsedPerMin: number,
    mpGainedPerMin: number,
    netMpPerMin: number,
    // Undefined if 0
    mpTime: number | undefined,
    healBasePotRatio: number,
    effectiveHealPotRatio: number,
}

export interface WhmSheetSettings extends SimSettings {
    hasBard: boolean,
    hasScholar: boolean,
    hasDragoon: boolean,
    ldPerMin: number,
    c3PerMin: number,
    m2PerMin: number,
    rezPerMin: number,
}

export const whmSheetSpec: SimSpec<WhmSheetSim, WhmSheetSettings> = {
    displayName: "WHM Sheet Sim (Old)",
    loadSavedSimInstance(exported: WhmSheetSettings) {
        return new WhmSheetSim(exported);
    },
    makeNewSimInstance(): WhmSheetSim {
        return new WhmSheetSim();
    },
    stub: "whm-sheet-sim",
    supportedJobs: ['WHM'],
}

// TODO: report MP time
export class WhmSheetSim implements Simulation<WhmSheetSimResult, WhmSheetSettings, WhmSheetSettings> {

    exportSettings(): WhmSheetSettings {
        return {...this.settings};
    };

    settings: WhmSheetSettings = {
        hasBard: true,
        hasScholar: true,
        hasDragoon: true,
        ldPerMin: 0,
        c3PerMin: 0,
        m2PerMin: 0,
        rezPerMin: 0
    };

    spec = whmSheetSpec;
    displayName = whmSheetSpec.displayName;
    shortName = "whm-sheet-sim";

    constructor(settings?: WhmSheetSettings) {
        if (settings) {
            Object.assign(this.settings, settings);
        }
    }

    makeConfigInterface(settings: WhmSheetSettings): HTMLElement {

        const outerDiv = document.createElement("div");
        const checkboxesDiv = document.createElement("div");

        const brdCheck = new FieldBoundCheckBox<WhmSheetSettings>(settings, 'hasBard', {id: 'brd-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('BRD in Party', brdCheck));
        const schCheck = new FieldBoundCheckBox<WhmSheetSettings>(settings, 'hasScholar', {id: 'sch-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('SCH in Party', schCheck));
        const drgCheck = new FieldBoundCheckBox<WhmSheetSettings>(settings, 'hasDragoon', {id: 'drg-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('DRG in Party', drgCheck));

        outerDiv.appendChild(checkboxesDiv);

        const ldPerMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'ldPerMin', {
            id: 'ldPerMin-input',
            postValidators: [positiveValuesOnly]
        });
        const ldPerMinLabel = labelFor('Lucid Dreaming/Minute', ldPerMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [ldPerMinLabel, ldPerMin]));

        const rezPerMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'rezPerMin', {
            id: 'rezPerMin-input',
            postValidators: [positiveValuesOnly]
        });
        const rezPerMinLabel = labelFor('Raise/Minute', rezPerMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [rezPerMinLabel, rezPerMin]));

        const m2perMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'm2PerMin', {
            id: 'm2PerMin-input',
            postValidators: [positiveValuesOnly]
        });
        const m2perMinLabel = labelFor('Medica II/Minute', m2perMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [m2perMinLabel, m2perMin]));

        const c3perMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'c3PerMin', {
            id: 'c3PerMin-input',
            postValidators: [positiveValuesOnly]
        });
        const c3perMinLabel = labelFor('Cure III/Minute', c3perMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [c3perMinLabel, c3perMin]));

        return outerDiv;
    }

    extraDhRate() {
        return (this.settings.hasBard ? (battleVoiceAvg + brdDhAvg) : 0);
    }

    extraCritRate() {
        return (this.settings.hasDragoon ? battleLitanyAvg : 0)
            + (this.settings.hasScholar ? chainStratAvg : 0)
            + (this.settings.hasBard ? brdCritAvg : 0);
    }

    async simulate(set: CharacterGearSet): Promise<WhmSheetSimResult> {
        const buffedStats = {...set.computedStats};
        buffedStats.dhitChance += this.extraDhRate();
        buffedStats.critChance += this.extraCritRate();
        const ppsFinalResult = this.pps(buffedStats);
        // const ppsFinalResult = pps(buffedStats.spellspeed, buffedStats.gcdMag, this.settings.c3PerMin, this.settings.m2PerMin, this.settings.rezPerMin);
        // console.log(ppsFinalResult);
        const resultWithoutDhCrit = baseDamage(buffedStats, ppsFinalResult);
        const result = applyDhCrit(resultWithoutDhCrit, buffedStats);
        // Uncomment to test async logic
        await new Promise(resolve => setTimeout(resolve, 200));
        const mpUsedPerMin = this.mpUsedPerSec(set.computedStats) * 60;
        const mpGainedPerMin = this.mpGainedPerSec(set.computedStats) * 60;
        const netMpPerMin = mpGainedPerMin - mpUsedPerMin;
        const mpTime = netMpPerMin >= 0 ? undefined : (-10000 / netMpPerMin);
        const healBasePotRatio = baseHealing(buffedStats, 100);
        const effectiveHealPotRatio = applyCrit(healBasePotRatio, buffedStats);
        return {
            mainDpsResult: result,
            pps: ppsFinalResult,
            mpUsedPerMin: mpUsedPerMin,
            mpGainedPerMin: mpGainedPerMin,
            netMpPerMin: netMpPerMin,
            mpTime: mpTime,
            healBasePotRatio: healBasePotRatio,
            effectiveHealPotRatio: effectiveHealPotRatio,
        }
    }

    afflatusTime(stats: ComputedSetStats, cycle: number) {
        return 6 * stats.gcdMag(2.5) * (cycle / 360 - 1);
    }

    fillerGcdPerMinute() {
        return this.settings.c3PerMin + this.settings.m2PerMin + this.settings.rezPerMin;
    }

// Average potency of a 360s rotation
    getP(stats: ComputedSetStats, cycle: number) {
        const filler = this.fillerGcdPerMinute();
        let result = 0
        result += 9 * assize * cycle / 360
        result += 6 * misery * cycle / 360
        const tickMulti = stats.spsDotMulti;
        const shortGcd = stats.gcdMag(2.5);
        if (glare - dia > diaDot / 3 * tickMulti * fl(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
            result += 12 * (Math.ceil(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
            // Logger.log("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
            result += 12 * 10 * tickMulti * diaDot
            // Logger.log("Dia ticks: " + 12*10)
        }
        else {
            result += 12 * (fl(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
            // Logger.log("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
            result += 12 * 9 * tickMulti * diaDot
            result += 12 * ((3 - (30 % shortGcd)) / 3) * tickMulti * diaDot
            // Logger.log("Dia ticks: " + (12*9+12*((3-(30 % shortGcd))/3)))
        }
        result -= filler * glare * cycle / 60
        // Logger.log("Potency: " + result)
        return result
    }

    /**
     * MP usage of a full cycle
     */
    getMP(stats: ComputedSetStats, cycle) {
        let result = 0;
        // TODO: why is the dot multiplier factored in here?
        const shortGcd = stats.gcdMag(2.5);
        if (glare - dia > diaDot / 3 * stats.spsDotMulti * fl(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
            result += 12 * (Math.ceil(30 / shortGcd)) * 400;
        }
        else {
            result += 12 * (fl(30 / shortGcd)) * 400;
        }
        //misery + lillies
        result -= 400 * cycle / 15;
        //assize
        result -= (500) * cycle / 40;
        result -= (3850) * this.settings.ldPerMin * cycle / 60;
        result += this.settings.rezPerMin * 2000 * cycle / 60;
        result += 600 * this.settings.m2PerMin * cycle / 60;
        result += 1100 * this.settings.c3PerMin * cycle / 60;
        //thin air
        result -= 400 * cycle / 60;
        return result
    }

    // Actual time taken by a 360s rotation
    getCycle(stats: ComputedSetStats) {
        var result = 0
        //1 dia + x glares/lily/misery
        const shortGcd = stats.gcdMag(2.5);
        if (glare - dia > diaDot / 3 * stats.spsDotMulti * fl(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
            result += 12 * (Math.ceil(30 / shortGcd) * shortGcd)
        }
        else {
            result += 12 * (fl(30 / shortGcd) * shortGcd)
        }
        // POM as multiplier normalized over 360s
        result *= 360 / ((45 / 0.80) + 315)
        // Logger.log("GCD: "+shortGcd+" Cycle: " +result)
        return result
    }

    // TODO: move all the 'x perminute' things into a single object we can pass around
    /**
     * Overall potency per second
     */
    pps(stats: ComputedSetStats) {
        var cycle = this.getCycle(stats);
        var afflatusT = this.afflatusTime(stats, cycle)
        cycle += afflatusT;
        return this.getP(stats, cycle) / cycle;
    }

    /**
     * MP used per second
     */
    mpUsedPerSec(stats: ComputedSetStats) {
        let cycle = this.getCycle(stats);
        const afflatusT = this.afflatusTime(stats, cycle);
        cycle += afflatusT;
        return this.getMP(stats, cycle) / cycle
    }

    mpGainedPerSec(stats: ComputedSetStats) {
        return stats.mpPerTick / 3;
    }

    netMpPerSec(stats: ComputedSetStats) {
        return this.mpGainedPerSec(stats) - this.mpUsedPerSec(stats);
    }

    MPTime(stats: ComputedSetStats) {
        let result = 0;
        result += stats.mpPerTick / 3
        result -= this.mpUsedPerSec(stats);
        return fl(-10000 / result)
    }

    // function summing(accumulator, currentValue) {
    //     return accumulator + currentValue
    // }
    //
    // function reduce(arr, callback, initialVal) {
    //     var accumulator = (initialVal === undefined) ? undefined : initialVal;
    //     for (var i = 0; i < arr.length; i++) {
    //         if (accumulator !== undefined) accumulator = callback.call(undefined, accumulator, arr[i], i, this); else accumulator = arr[i];
    //     }
    //     return accumulator;
    // }

    //Party buff things

    // Traits
    // const magicAndMend = 1.3;
    //
    // // jobmod etc
    // const levelMod = 1900;
    // const baseMain = 390
    // const baseSub = 400
    //
    // function CalcPiety(Pie) {
    //     return 200 + (Math.floor(150 * (Pie - baseMain) / levelMod));
    // }
    //
}