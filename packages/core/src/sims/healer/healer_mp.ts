import { CharacterGearSet } from "@xivgear/core/gear";
import { SimResult, SimSettings, SimSpec, Simulation } from "@xivgear/core/sims/sim_types";
import { NORMAL_GCD } from "@xivgear/xivmath/xivconstants";
import { EmptyObject } from "../../util/types";

const maxMP = 10000;

const lucidPotency = 55;
const lucidDuration = 21;
const lucidCooldown = 60;

const fillerMP = 400;

const drawCooldown = 60;
const drawMP = 2000;

const aetherflowCooldown = 60;
const aetherflowMP = 2000;

const addersgallCooldown = 20;
const addersgallMP = 700;
const rhizomataCooldown = 90;

const assizeCooldown = 40;
const assizeMP = 500;
const lilyCooldown = 20;
//const lilyMP = 0;
const thinAirCooldown = 60;
const glare4Cooldown = 120;


export interface MPResult extends SimResult {
    baseRegen: number;
    minutesToZero: number | 'Positive';
}

export interface MPSettings extends SimSettings {
    //job: 'AST' | 'SCH' | 'SGE' | 'WHM';
}

export const mpSimSpec: SimSpec<MPPerMinute, MPSettings> = {
    displayName: "MP per Minute",
    loadSavedSimInstance(exported: MPSettings) {
        return new MPPerMinute();
    },
    makeNewSimInstance(): MPPerMinute {
        return new MPPerMinute();
    },
    stub: "mp-sim",
    description: "Mp economy",
    isDefaultSim: false,
    supportedJobs: ['AST', 'SCH', 'SGE', 'WHM'],
};

export class MPPerMinute implements Simulation<MPResult, MPSettings, EmptyObject>{
    exportSettings() {
        return {
            ...this.settings,
        };
    }
    spec = mpSimSpec;
    shortName = 'mp';
    displayName = mpSimSpec.displayName;
    settings = {};

    async simulate(set: CharacterGearSet): Promise<MPResult> {
        let mpResult: number = 0;
        let baseRegen: number = 0;
        let minutesToZero: number | 'Positive';
        const tick = set.computedStats.mpPerTick;
        const job = set.computedStats.job;
        baseRegen = (tick * 20);
        mpResult += baseRegen;

        const lucidTotal = (lucidPotency * 10) * (lucidDuration / 3);
        mpResult += lucidTotal * (60 / lucidCooldown);

        const speed = set.computedStats.gcdMag(NORMAL_GCD, 0);
        let numFillerGCDs = (60 / speed);

        if (job === "AST") {
            mpResult += drawMP * (60 / drawCooldown);
        }

        if (job === "SCH") {
            mpResult += aetherflowMP * (60 / aetherflowCooldown);
        }

        if (job === "SGE") {
            mpResult += addersgallMP * (60 / addersgallCooldown);
            mpResult += addersgallMP * (60 / rhizomataCooldown);
        }

        if (job === "WHM") {
            mpResult += assizeMP * (60 / assizeCooldown);
            numFillerGCDs -= (60 / ((3 / 4) * lilyCooldown));
            numFillerGCDs -= (60 / thinAirCooldown);
            numFillerGCDs -= (60 / (glare4Cooldown / 3));
        }

        mpResult -= (numFillerGCDs * fillerMP);

        if (mpResult < 0){
            minutesToZero = -1 * maxMP / mpResult;
        }
        else {
            minutesToZero = "Positive";
        }

        return {
            mainDpsResult: mpResult,
            baseRegen: baseRegen,
            minutesToZero: minutesToZero,
        };
    }
}
