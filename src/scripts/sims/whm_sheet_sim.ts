import {SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {applyDhCrit, baseDamage, spsTickMulti} from "../xivmath";
import {ComputedSetStats} from "../geartypes";
import {
    FieldBoundCheckBox,
    FieldBoundFloatField,
    FieldBoundIntField,
    labeledCheckbox,
    labelFor, positiveValuesOnly,
    quickElement
} from "../components";


//potencies for our spells

const glare = 310
const dia = 65
const diaDot = 65
const assize = 400
const misery = 1240

function afflatusTime(shortGcd, cycle) {
    return 6 * shortGcd * (cycle / 360 - 1);
}

// Average potency of a 360s rotation
function getP(sps, shortGcd, filler, cycle) {
    let result = 0
    result += 9 * assize * cycle / 360
    result += 6 * misery * cycle / 360
    if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
        result += 12 * (Math.ceil(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
        // Logger.log("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
        result += 12 * 10 * spsTickMulti(sps) * diaDot
        // Logger.log("Dia ticks: " + 12*10)
    }
    else {
        result += 12 * (Math.floor(30 / shortGcd) - 1) * glare + 12 * dia - 24 * glare
        // Logger.log("# Glares: " + 12*(Math.ceil(30/shortGcd)-1)-24*glare)
        result += 12 * 9 * spsTickMulti(sps) * diaDot
        result += 12 * ((3 - (30 % shortGcd)) / 3) * spsTickMulti(sps) * diaDot
        // Logger.log("Dia ticks: " + (12*9+12*((3-(30 % shortGcd))/3)))
    }
    result -= filler * glare * cycle / 60
    // Logger.log("Potency: " + result)
    return result
}

function getMP(shortGcd, sps, LDs, m2s, c3s, rezz, cycle) {
    var result = 0
    if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
        result += 12 * (Math.ceil(30 / shortGcd)) * 400
    }
    else {
        result += 12 * (Math.floor(30 / shortGcd)) * 400
    }
    //misery + lillies
    result -= 400 * cycle / 15
    //assize
    result -= (500) * cycle / 40
    result -= (3850) * LDs * cycle / 60
    result += rezz * 2000 * cycle / 60
    result += 600 * m2s * cycle / 60
    result += 1100 * c3s * cycle / 60
    //thin air
    result -= 400 * cycle / 60
    return result
}

// Actual time taken by a 360s rotation
function getCycle(shortGcd, sps) {
    var result = 0
    //1 dia + x glares/lily/misery
    if (glare - dia > diaDot / 3 * spsTickMulti(sps) * Math.floor(30 / shortGcd) * (shortGcd - 30 % shortGcd)) {
        result += 12 * (Math.ceil(30 / shortGcd) * shortGcd)
    }
    else {
        result += 12 * (Math.floor(30 / shortGcd) * shortGcd)
    }
    // POM as multiplier normalized over 360s
    result *= 360 / ((45 / 0.80) + 315)
    // Logger.log("GCD: "+shortGcd+" Cycle: " +result)
    return result
}

// TODO: move all the 'x perminute' things into a single object we can pass around
function pps(sps: number, shortGcd: number, cure3perMinute: number, medica2perMinute: number, rezPerMinute: number) {
    var cycle = getCycle(shortGcd, sps)
    var afflatusT = afflatusTime(shortGcd, cycle)
    cycle += afflatusT
    return getP(sps, shortGcd, cure3perMinute + medica2perMinute + rezPerMinute, cycle) / cycle;
}

function mpps(shortGcd: number, sps: number, lucidPerMinute: number, cure3perMinute: number, medica2perMinute: number, rezPerMinute: number) {
    var cycle = getCycle(shortGcd, sps)
    var afflatusT = afflatusTime(shortGcd, cycle)
    cycle += afflatusT
    return getMP(shortGcd, sps, lucidPerMinute, medica2perMinute, cure3perMinute, rezPerMinute, cycle) / cycle
}

function MPTime(pie, shortGcd, sps, LDs, c3s, m2s, rezz) {
    var result = 0
    result += CalcPiety(pie) / 3
    result -= mpps(shortGcd, sps, LDs, c3s, m2s, rezz)
    return Math.floor(-10000 / result)
}

function summing(accumulator, currentValue) {
    return accumulator + currentValue
}

function reduce(arr, callback, initialVal) {
    var accumulator = (initialVal === undefined) ? undefined : initialVal;
    for (var i = 0; i < arr.length; i++) {
        if (accumulator !== undefined) accumulator = callback.call(undefined, accumulator, arr[i], i, this); else accumulator = arr[i];
    }
    return accumulator;
}

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

export interface WhmSheetSimResult extends SimResult {
    pps: number,
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
    displayName: "WHM Sheet Sim",
    loadSavedSimInstance(exported: WhmSheetSettings) {
        return new WhmSheetSim(exported);
    },
    makeNewSimInstance(): WhmSheetSim {
        return new WhmSheetSim();
    },
    stub: "whm-sheet-sim",
    supportedJobs: ['WHM'],
}

// TODO: X spell uses per minute
// TODO: report MP time
export class WhmSheetSim implements Simulation<WhmSheetSimResult, WhmSheetSettings, WhmSheetSettings> {

    exportSettings(): WhmSheetSettings {
        return {...this.settings};
    };

    settings = {
        hasBard: true,
        hasScholar: true,
        hasDragoon: true,
        ldPerMin: 0,
        c3PerMin: 0,
        m2PerMin: 0,
        rezPerMin: 0
    };

    spec = whmSheetSpec;
    displayName = "WHM Sheet Sim";
    shortName = "whm-sheet-sim";

    constructor(settings?: WhmSheetSettings) {
        if (settings) {
            console.log("Loading sim settings", settings)
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

        const ldPerMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'ldPerMin', {id: 'ldPerMin-input', postValidators: [positiveValuesOnly]});
        const ldPerMinLabel = labelFor('Lucid Dreaming/Minute', ldPerMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [ldPerMinLabel, ldPerMin]));

        const rezPerMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'rezPerMin', {id: 'rezPerMin-input', postValidators: [positiveValuesOnly]});
        const rezPerMinLabel = labelFor('Raise/Minute', rezPerMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [rezPerMinLabel, rezPerMin]));

        const m2perMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'm2PerMin', {id: 'm2PerMin-input', postValidators: [positiveValuesOnly]});
        const m2perMinLabel = labelFor('Medica II/Minute', m2perMin);
        outerDiv.appendChild(quickElement("div", ['labeled-item'], [m2perMinLabel, m2perMin]));

        const c3perMin = new FieldBoundFloatField<WhmSheetSettings>(settings, 'c3PerMin', {id: 'c3PerMin-input', postValidators: [positiveValuesOnly]});
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
        const ppsFinalResult = pps(buffedStats.spellspeed, buffedStats.gcdMag, this.settings.c3PerMin, this.settings.m2PerMin, this.settings.rezPerMin);
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