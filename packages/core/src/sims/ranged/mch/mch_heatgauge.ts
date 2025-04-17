import {MchHeatGaugeState} from "./mch_types";

export class MchheatGauge {

    private _heatGauge: number = 0;

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
            heatGauge: this.heatGauge,
        };
    }
}
