import {SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {applyDhCrit, baseDamage} from "../xivmath";
import {ComputedSetStats} from "../geartypes";
import {FieldBoundCheckBox, labeledCheckbox} from "../components";


//potencies for our spells
const dosis3pot = 330
const edosis3tickPot = 75
const phlegmaPot = 600


//Party buff things
const battleVoiceAvg = (15 / 120) * 0.2;
const battleLitanyAvg = (15 / 120) * 0.1;
const chainStratAvg = (15 / 120) * 0.1;
const devilmentAvg = (20 / 120) * 0.2;
const brdCritAvg = (45 / 120) * 0.02;
const brdDhAvg = (45 / 120) * 0.03;


export interface SgeSheetSimResult extends SimResult {
    pps: number,
}

export interface SgeSheetSettings extends SimSettings {
    hasBard: boolean,
    hasScholar: boolean,
    hasDragoon: boolean,
    rezPerMin: number,
    diagPerMin: number,
    progPerMin: number,
    eDiagPerMin: number,
    eProgPerMin: number,
    toxPerMin: number
}

export const sgeSheetSpec: SimSpec<SgeSheetSim, SgeSheetSettings> = {
    displayName: "SGE Sheet Sim",
    loadSavedSimInstance(exported: SgeSheetSettings) {
        return new SgeSheetSim(exported);
    },
    makeNewSimInstance(): SgeSheetSim {
        return new SgeSheetSim();
    },
    stub: "sge-sheet-sim",
    supportedJobs: ['SGE'],
}

export class SgeSheetSim implements Simulation<SgeSheetSimResult, SgeSheetSettings, SgeSheetSettings> {

    exportSettings(): SgeSheetSettings {
        return {...this.settings};
    };

    settings: SgeSheetSettings = {
        hasBard: true,
        hasScholar: true,
        hasDragoon: true,
        rezPerMin: 0,
        diagPerMin: 0,
        progPerMin: 0,
        eDiagPerMin: 0,
        eProgPerMin: 0,
        // TODO: pick reasonable defaults
        toxPerMin: 0
    };

    spec = sgeSheetSpec;
    displayName = "SGE Sheet Sim";
    shortName = "sge-sheet-sim";

    constructor(settings?: SgeSheetSettings) {
        if (settings) {
            console.log("Loading sim settings", settings)
            Object.assign(this.settings, settings);
        }
    }

    makeConfigInterface(settings: SgeSheetSettings): HTMLElement {
        const div = document.createElement("div");
        const brdCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasBard', {id: 'brd-checkbox'});
        div.appendChild(labeledCheckbox('BRD in Party', brdCheck));
        const schCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasScholar', {id: 'sch-checkbox'});
        div.appendChild(labeledCheckbox('SCH in Party', schCheck));
        const drgCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasDragoon', {id: 'drg-checkbox'});
        div.appendChild(labeledCheckbox('DRG in Party', drgCheck));
        return div;
    }

    extraDhRate() {
        return (this.settings.hasBard ? (battleVoiceAvg + brdDhAvg) : 0);
    }

    extraCritRate() {
        return (this.settings.hasDragoon ? battleLitanyAvg : 0)
            + (this.settings.hasScholar ? chainStratAvg : 0)
            + (this.settings.hasBard ? brdCritAvg : 0);
    }

    async simulate(set: CharacterGearSet): Promise<SgeSheetSimResult> {
        const buffedStats = {...set.computedStats};
        buffedStats.dhitChance += this.extraDhRate();
        buffedStats.critChance += this.extraCritRate();
        const ppsFinalResult = this.pps(buffedStats);
        // console.log(ppsFinalResult);
        const resultWithoutDhCrit = baseDamage(buffedStats, ppsFinalResult);
        const result = applyDhCrit(resultWithoutDhCrit, buffedStats);
        // Uncomment to test async logic
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
            mainDpsResult: result,
            pps: ppsFinalResult,
        }
    }

    PhlegmaB(cycle: number) {
        return (phlegmaPot - dosis3pot) * (cycle / 40);
    }

    PhlegmaTime(stats: ComputedSetStats, cycle: number) {
        const shortGcd = stats.gcdMag(2.5);
        return shortGcd * ((cycle / 40) - 4);
    }


    fillerGcdPerMinute() {
        return this.settings.rezPerMin
            + this.settings.diagPerMin + this.settings.eDiagPerMin
            + this.settings.progPerMin + this.settings.eProgPerMin;
    }
// Average potency of a 180s rotation
    getP(stats: ComputedSetStats, cycle: number) {
        let result = 0
        result += this.PhlegmaB(cycle)
        const spsScalar = stats.spsDotMulti;
        const shortGcd = stats.gcdMag(2.5);
        const filler = this.fillerGcdPerMinute();
        // 1 dot + x dosis3pot
        if (2.5 * dosis3pot > edosis3tickPot / 3 * spsScalar * (2.5 + Math.floor(27.5 / shortGcd) * shortGcd) * (shortGcd - 27.5 % shortGcd)) {
            result += 6 * (Math.ceil((27.5) / (shortGcd))) * dosis3pot
            result += 6 * 10 * spsScalar * edosis3tickPot
        }
        else {
            result += 6 * (Math.floor((27.5) / (shortGcd))) * dosis3pot
            result += 6 * 9 * spsScalar * edosis3tickPot
            result += 6 * ((3 - (30 % shortGcd)) / 3) * spsScalar * edosis3tickPot
        }
        result -= filler * dosis3pot * cycle / 60
        console.info("GCD: " + shortGcd + " Potency: " + result)
        return result
    }
    //
    // getMP(shortGcd, sps, D, P, ED, EP, T, rezz, cycle) {
    //     var result = 0
    //     if (2.5 * dosis3pot > edosis3tickPot / 3 * this.SpsScalar(sps) * (2.5 + Math.floor(27.5 / shortGcd) * shortGcd) * (shortGcd - 27.5 % shortGcd)) {
    //         result += 6 * (Math.ceil((27.5) / (shortGcd)) + 1) * 400
    //     }
    //     else {
    //         result += 6 * (Math.floor((27.5) / (shortGcd)) + 1) * 400
    //     }
    //     result += 400 * P * cycle / 60
    //     result += 500 * ED * cycle / 60
    //     result += 500 * EP * cycle / 60
    //     result -= 400 * T * cycle / 60
    //     result += 2000 * rezz * cycle / 60
    //     //Phlegma
    //     result += 400 * ((cycle / 40) - 4)
    //     //Addersgall
    //     result -= 2100 * cycle / 60
    //     //Rhizo
    //     result -= 700 * cycle / 90
    //     //LD
    //     result -= 3850 * cycle / 60
    //     return result
    // }

// Actual time taken by a 180s rotation
    getCycle(stats: ComputedSetStats) {
        var result = 0
        //1 dot + x dosis3pot
        const shortGcd = stats.gcdMag(2.5);
        if (2.5 * dosis3pot > edosis3tickPot / 3 * stats.spsDotMulti * (2.5 + Math.floor(27.5 / shortGcd) * shortGcd) * (shortGcd - 27.5 % shortGcd)) {
            result += 6 * (Math.ceil((27.5) / (shortGcd)) * (shortGcd) + 2.5)
        }
        else {
            result += 6 * (Math.floor((27.5) / (shortGcd)) * (shortGcd) + 2.5)
        }
        console.info("GCD: " + shortGcd + " Cycle: " + result)
        return result;
    }

    pps(stats: ComputedSetStats) {
        let cycle = this.getCycle(stats);
        cycle += this.PhlegmaTime(stats, cycle);
        return this.getP(stats, cycle) / cycle;
    }

    // mpps(shortGcd, sps, D, P, ED, EP, T, rezz) {
    //     var cycle = this.getCycle(shortGcd, sps)
    //     cycle += this.PhlegmaTime(shortGcd, cycle)
    //     return this.getMP(shortGcd, sps, D, P, ED, EP, T, rezz, cycle) / cycle
    // }
    //
    // MPTime(pie, shortGcd, sps, D, P, ED, EP, T, rezz) {
    //     var result = 0
    //     result += this.CalcPiety(pie) / 3
    //     result -= this.mpps(shortGcd, sps, D, P, ED, EP, T, rezz)
    //     return Math.floor(-10000 / result)
    // }
    //
    // summing(accumulator, currentValue) {
    //     return accumulator + currentValue
    // }
    //
    // reduce(arr, callback, initialVal) {
    //     var accumulator = (initialVal === undefined) ? undefined : initialVal;
    //     for (var i = 0; i < arr.length; i++) {
    //         if (accumulator !== undefined)
    //             accumulator = callback.call(undefined, accumulator, arr[i], i, this);
    //         else
    //             accumulator = arr[i];
    //     }
    //     return accumulator;
    // }

    //
    // CalcPiety(Pie) {
    //     return 200 + (Math.floor(150 * (Pie - baseMain) / levelMod));
    // }
    //
    // Healing(Potency, WD, JobMod, MainStat, Det, Crit, SS, TEN, classNum) {
    //
    //     MainStat = Math.floor(MainStat * (1 + 0.01 * classNum));
    //     var Damage = Math.floor(Potency * (WD + Math.floor(baseMain * JobMod / 1000)) * (100 + Math.floor((MainStat - baseMain) * 569 / 1522)) / 100);
    //     Damage = Math.floor(Damage * (1000 + Math.floor(140 * (Det - baseMain) / levelMod)) / 1000);
    //     Damage = Math.floor(Damage * (1000 + Math.floor(100 * (TEN - baseSub) / levelMod)) / 1000);
    //     Damage = Math.floor(Damage * (1000 + Math.floor(130 * (SS - baseSub) / levelMod)) / 1000 / 100);
    //     Damage = Math.floor(Damage * magicAndMend)
    //     /*var CritDamage=Math.fl(Damage*(1000 * CalcCritDamage(Crit))/1000);
    //     var CritRate=CalcCritRate(Crit);
    //     var NormalRate=1-CritRate*/
    //
    //     return Damage //* NormalRate + CritDamage * (CritRate);
    // }

}