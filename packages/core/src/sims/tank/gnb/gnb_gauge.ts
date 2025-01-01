import {GnbGaugeState} from "./gnb_types";

export class GnbGauge {
    private _maxCartridges: number;
    private _cartridges: number = 0;

    constructor(level: number) {
        if (level >= 88) {
            this._maxCartridges = 3;
        }
        else {
            this._maxCartridges = 2;
        }
    }

    get cartridges(): number {
        return this._cartridges;
    }

    get maxCartridges(): number {
        return this._maxCartridges;
    }

    set cartridges(newGauge: number) {
        if (newGauge > this._maxCartridges) {
            console.warn(`[GNB Sim] Overcapped Cartridges by ${newGauge - this._maxCartridges}.`);
        }
        if (newGauge < 0) {
            console.warn(`[GNB Sim] Used ${this._cartridges - newGauge} cartridges when you only have ${this._cartridges}.`);
        }
        this._cartridges = Math.max(Math.min(newGauge, this._maxCartridges), 0);
    }

    getGaugeState(): GnbGaugeState {
        return {
            maxCartridges: this.maxCartridges,
            cartridges: this.cartridges,
        };
    }
}
