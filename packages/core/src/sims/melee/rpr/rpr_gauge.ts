import { RprGaugeState } from "./rpr_types";

export class RprGauge {

    private _soulGauge: number = 0;
    get soulGauge(): number {
        return this._soulGauge;
    }
    set soulGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Soul by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`Used ${this._soulGauge - newGauge} soul when you only have ${this._soulGauge}.`);
        }
        this._soulGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    _shroudGauge: number = 0;
    get shroudGauge(): number {
        return this._shroudGauge;
    }
    set shroudGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped shroud by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`Used ${this._shroudGauge - newGauge} shroud when you only have ${this._shroudGauge}.`);
        }
        this._shroudGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    getGaugeState(): RprGaugeState {
        return {
            level: 100,
            soul: this.soulGauge,
            shroud: this.shroudGauge,
        };
    }
}
