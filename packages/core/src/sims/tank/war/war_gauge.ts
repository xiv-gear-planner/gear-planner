import { WarGaugeState } from "./war_types";

export class WarGauge {

    private _beastGauge: number = 0;

    get beastGauge(): number {
        return this.beastGauge;
    }
    
    set beastGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`[WAR Sim] Overcapped Beast Gauge by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`[WAR Sim] Used ${this._beastGauge - newGauge} beast gauge when you only have ${this._beastGauge}.`)
        }
        this._beastGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    getGaugeState(): WarGaugeState {
        return {
            level: 100,
            beastGauge: this.beastGauge,
        }
    }
}
