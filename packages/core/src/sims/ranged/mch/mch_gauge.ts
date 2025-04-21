import {MchGaugeState} from "./mch_types";

export class MchGauge {

    private _batteryGauge: number = 0;
    private _heatGauge: number = 0;

    get batteryGauge(): number {
        return this._batteryGauge;
    }

    set batteryGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`[MCH Sim] Overcapped Battery Gauge by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`[MCH Sim] Used ${this._batteryGauge - newGauge} Battery gauge when you only have ${this._batteryGauge}.`);
        }
        this._batteryGauge = Math.max(Math.min(newGauge, 100), 0);
    }


    get heatGauge(): number {
        return this._heatGauge;
    }

    set heatGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`[MCH Sim] Overcapped Heat Gauge by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`[MCH Sim] Used ${this._heatGauge - newGauge} heat gauge when you only have ${this._heatGauge}.`);
        }
        this._heatGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    getGaugeState(): MchGaugeState {
        return {
            batteryGauge: this.batteryGauge,
            heatGauge: this.heatGauge,
        };
    }


}
