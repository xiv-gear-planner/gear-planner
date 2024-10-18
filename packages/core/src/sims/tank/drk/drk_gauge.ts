import {DrkGaugeState} from "./drk_types";
import {PersonalBuff} from "@xivgear/core/sims/sim_types";

export class DrkGauge {

    private _bloodGauge: number = 0;
    private _magicPoints: number = 10000;
    private _darkArts: boolean;

    get bloodGauge(): number {
        return this._bloodGauge;
    }

    get magicPoints(): number {
        return this._magicPoints;
    }

    get darkArts(): boolean {
        return this._darkArts;
    }
    
    set bloodGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`[DRK Sim] Overcapped Blood by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`[DRK Sim] Used ${this._bloodGauge - newGauge} blood when you only have ${this._bloodGauge}.`)
        }
        this._bloodGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    set magicPoints(newGauge: number) {
        if (newGauge > 10000) {
            console.warn(`[DRK Sim] Overcapped MP by ${newGauge - 10000}.`);
        }
        if (newGauge < 0) {
            console.warn(`[DRK Sim] Used ${this._magicPoints - newGauge} MP when you only have ${this._magicPoints}.`)
        }
        this._magicPoints = Math.max(Math.min(newGauge, 10000), 0);
    }

    set darkArts(newDarkArts: boolean) {
        this._darkArts = newDarkArts
    }

    getGaugeState(): DrkGaugeState {
        return {
            level: 100,
            blood: this.bloodGauge,
            mp: this.magicPoints,
            darkArts: this.darkArts,
        }
    }
}

// I implemented this as a buff because that's essentially what it is,
// but it's in the gauge section because, well, it is a gauge.
export const Darkside: PersonalBuff = {
    name: "Darkside",
    saveKey: "Darkside",
    duration: 30,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.1,
    },
    maxStackingDuration: 60,
};