import {GnbGaugeState} from "./gnb_types";

export class GnbGauge {

    private _cartridges: number = 0;

    get cartridges(): number {
        return this._cartridges;
    }

    set cartridges(newGauge: number) {
        if (newGauge > 3) {
            console.warn(`[GNB Sim] Overcapped Cartriges by ${newGauge - 3}.`);
        }
        if (newGauge < 0) {
            console.warn(`[GNB Sim] Used ${this._cartridges - newGauge} cartriges when you only have ${this._cartridges}.`);
        }
        this._cartridges = Math.max(Math.min(newGauge, 3), 0);
    }

    getGaugeState(): GnbGaugeState {
        return {
            level: 100,
            cartridges: this.cartridges,
        };
    }
}
