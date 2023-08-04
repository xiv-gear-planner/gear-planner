import {SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {baseDamage} from "../xivmath";
import {ComputedSetStats} from "../geartypes";
import {FieldBoundCheckBox, labeledCheckbox} from "../components";


//potencies for our spells
const dosis3pot = 330
const edosis3tickPot = 75
const phlegmaPot = 600

function PhlegmaB(cycle) {
    return (phlegmaPot - dosis3pot) * (cycle / 40);
}

function PhlegmaTime(shortGcd, cycle) {
    return shortGcd * ((cycle / 40) - 4);
}

// Average potency of a 180s rotation
function getP(shortGcd, sps, filler, cycle) {
    var result = 0
    result += PhlegmaB(cycle)
    // 1 dot + x dosis3pot
    if (2.5 * dosis3pot > edosis3tickPot / 3 * SpsScalar(sps) * (2.5 + Math.floor(27.5 / shortGcd) * shortGcd) * (shortGcd - 27.5 % shortGcd)) {
        result += 6 * (Math.ceil((27.5) / (shortGcd))) * dosis3pot
        result += 6 * 10 * SpsScalar(sps) * edosis3tickPot
    }
    else {
        result += 6 * (Math.floor((27.5) / (shortGcd))) * dosis3pot
        result += 6 * 9 * SpsScalar(sps) * edosis3tickPot
        result += 6 * ((3 - (30 % shortGcd)) / 3) * SpsScalar(sps) * edosis3tickPot
    }
    result -= filler * dosis3pot * cycle / 60
    console.info("GCD: " + shortGcd + " Potency: " + result)
    return result
}

function getMP(shortGcd, sps, D, P, ED, EP, T, rezz, cycle) {
    var result = 0
    if (2.5 * dosis3pot > edosis3tickPot / 3 * SpsScalar(sps) * (2.5 + Math.floor(27.5 / shortGcd) * shortGcd) * (shortGcd - 27.5 % shortGcd)) {
        result += 6 * (Math.ceil((27.5) / (shortGcd)) + 1) * 400
    }
    else {
        result += 6 * (Math.floor((27.5) / (shortGcd)) + 1) * 400
    }
    result += 400 * P * cycle / 60
    result += 500 * ED * cycle / 60
    result += 500 * EP * cycle / 60
    result -= 400 * T * cycle / 60
    result += 2000 * rezz * cycle / 60
    //Phlegma
    result += 400 * ((cycle / 40) - 4)
    //Addersgall
    result -= 2100 * cycle / 60
    //Rhizo
    result -= 700 * cycle / 90
    //LD
    result -= 3850 * cycle / 60
    return result
}

// Actual time taken by a 180s rotation
function getCycle(shortGcd, sps) {
    var result = 0
    //1 dot + x dosis3pot
    if (2.5 * dosis3pot > edosis3tickPot / 3 * SpsScalar(sps) * (2.5 + Math.floor(27.5 / shortGcd) * shortGcd) * (shortGcd - 27.5 % shortGcd)) {
        result += 6 * (Math.ceil((27.5) / (shortGcd)) * (shortGcd) + 2.5)
    }
    else {
        result += 6 * (Math.floor((27.5) / (shortGcd)) * (shortGcd) + 2.5)
    }
    console.info("GCD: " + shortGcd + " Cycle: " + result)
    return result
}

function pps(shortGcd, sps, D, P, ED, EP, rezz) {
    var cycle = getCycle(shortGcd, sps)
    cycle += PhlegmaTime(shortGcd, cycle)
    return getP(shortGcd, sps, D + P + ED + EP + rezz, cycle) / cycle;
}

function mpps(shortGcd, sps, D, P, ED, EP, T, rezz) {
    var cycle = getCycle(shortGcd, sps)
    cycle += PhlegmaTime(shortGcd, cycle)
    return getMP(shortGcd, sps, D, P, ED, EP, T, rezz, cycle) / cycle
}

function MPTime(pie, shortGcd, sps, D, P, ED, EP, T, rezz) {
    var result = 0
    result += CalcPiety(pie) / 3
    result -= mpps(shortGcd, sps, D, P, ED, EP, T, rezz)
    return Math.floor(-10000 / result)
}

function summing(accumulator, currentValue) {
    return accumulator + currentValue
}

function reduce(arr, callback, initialVal) {
    var accumulator = (initialVal === undefined) ? undefined : initialVal;
    for (var i = 0; i < arr.length; i++) {
        if (accumulator !== undefined)
            accumulator = callback.call(undefined, accumulator, arr[i], i, this);
        else
            accumulator = arr[i];
    }
    return accumulator;
}


function SpsScalar(SpS) {
    var S = ((1000 + Math.floor(130 * (SpS - 400) / 1900)) / 1000);
    return S;
}

// // Average potency of a 360s rotation
// function getP(sps, shortGcd, filler, cycle) {
//     let result = 0
//     result += 9 * assize * cycle / 360
//     result += 6 * misery * cycle / 360
//     if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
//         result += 12 * (Math.ceil(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
//         // console.info("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
//         result += 12 * 10 * spsTickMulti(sps) * diaDot
//         // console.info("Dia ticks: " + 12*10)
//     }
//     else {
//         result += 12 * (Math.floor(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
//         // console.info("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
//         result += 12 * 9 * spsTickMulti(sps) * diaDot
//         result += 12 * ((3 - (30 % shortGcd)) / 3) * spsTickMulti(sps) * diaDot
//         // console.info("Dia ticks: " + (12*9+12*((3-(30 % shortGcd))/3)))
//     }
//     result -= filler * glare * cycle / 60
//     // console.info("Potency: " + result)
//     return result
// }

// function getMP(shortGcd, sps, LDs, m2s, c3s, rezz, cycle) {
//     var result = 0
//     if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
//         result += 12 * (Math.ceil(30 / shortGcd)) * 400
//     }
//     else {
//         result += 12 * (Math.floor(30 / shortGcd)) * 400
//     }
//     //misery + lillies
//     result -= 400 * cycle / 15
//     //assize
//     result -= (500) * cycle / 40
//     result -= (3850) * LDs * cycle / 60
//     result += rezz * 2000 * cycle / 60
//     result += 600 * m2s * cycle / 60
//     result += 1100 * c3s * cycle / 60
//     //thin air
//     result -= 400 * cycle / 60
//     return result
// }

//Party buff things
const battleVoiceAvg = (15 / 120) * 0.2;
const battleLitanyAvg = (15 / 120) * 0.1;
const chainStratAvg = (15 / 120) * 0.1;
const devilmentAvg = (20 / 120) * 0.2;
const brdCritAvg = (45 / 120) * 0.02;
const brdDhAvg = (45 / 120) * 0.03;

// Traits
const magicAndMend = 1.3;

// jobmod etc
const levelMod = 1900;
const baseMain = 390
const baseSub = 400

const fl = Math.floor;

function floorTo(places: number, value: number) {
    return Math.floor(value * (10 ^ places)) * (10 ^ -places);
}


function CalcPiety(Pie) {
    return 200 + (Math.floor(150 * (Pie - baseMain) / levelMod));
}

function Healing(Potency, WD, JobMod, MainStat, Det, Crit, SS, TEN, classNum) {

    MainStat = Math.floor(MainStat * (1 + 0.01 * classNum));
    var Damage = Math.floor(Potency * (WD + Math.floor(baseMain * JobMod / 1000)) * (100 + Math.floor((MainStat - baseMain) * 569 / 1522)) / 100);
    Damage = Math.floor(Damage * (1000 + Math.floor(140 * (Det - baseMain) / levelMod)) / 1000);
    Damage = Math.floor(Damage * (1000 + Math.floor(100 * (TEN - baseSub) / levelMod)) / 1000);
    Damage = Math.floor(Damage * (1000 + Math.floor(130 * (SS - baseSub) / levelMod)) / 1000 / 100);
    Damage = Math.floor(Damage * magicAndMend)
    /*var CritDamage=Math.fl(Damage*(1000 * CalcCritDamage(Crit))/1000);
    var CritRate=CalcCritRate(Crit);
    var NormalRate=1-CritRate*/

    return Damage //* NormalRate + CritDamage * (CritRate);
}

function applyDhCrit(baseDamage: number, stats: ComputedSetStats) {
    return baseDamage * (1 + stats.dhitChance * (stats.dhitMulti - 1)) * (1 + stats.critChance * (stats.critMulti - 1));
}

export interface SgeSheetSimResult extends SimResult {
    pps: number,
}

export interface SgeSheetSettings extends SimSettings {
    hasBard: boolean,
    hasScholar: boolean,
    hasDragoon: boolean;
}

export const sgeSheetSpec: SimSpec<WhmSheetSim, SgeSheetSettings> = {
    displayName: "SGE Sheet Sim",
    loadSavedSimInstance(exported: SgeSheetSettings) {
        return new WhmSheetSim(exported);
    },
    makeNewSimInstance(): WhmSheetSim {
        return new WhmSheetSim();
    },
    stub: "sge-sheet-sim",
    supportedJobs: ['SGE'],
}

export class WhmSheetSim implements Simulation<SgeSheetSimResult, SgeSheetSettings, SgeSheetSettings> {

    exportSettings(): SgeSheetSettings {
        return {...this.settings};
    };

    settings = {
        hasBard: true,
        hasScholar: true,
        hasDragoon: true
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
        const ppsFinalResult = pps(buffedStats.spellspeed, buffedStats.gcdMag, 0, 0, 0, 0, 0);
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
}