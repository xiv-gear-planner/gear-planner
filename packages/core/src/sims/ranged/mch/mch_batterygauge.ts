import {MchBatteryGaugeState} from "./mch_types";

export class MchbatteryGauge {

    private _batteryGauge: number = 0;

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

    getGaugeState(): MchGaugeState {
        return {
            batteryGauge: this.batteryGauge,
        };
    }
}
