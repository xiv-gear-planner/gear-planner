import {GnbGaugeState} from "./gnb_types";

export class GnbGauge {
    private _maxCartridges: number;
    private _baseCartridges: number = 0;
    // Set from Bloodfest
    private _bonusCartridges: number = 0;

    constructor(level: number) {
        if (level >= 88) {
            this._maxCartridges = 3;
        }
        else {
            this._maxCartridges = 2;
        }
    }

    get cartridges(): number {
        return this._baseCartridges + this.bonusCartridges;
    }

    get bonusCartridges(): number {
        return this._bonusCartridges;
    }

    get maxCartridges(): number {
        return this._maxCartridges;
    }

    set cartridges(newGauge: number) {
        if (newGauge > this._maxCartridges) {
            console.warn(`[GNB Sim] Overcapped Cartridges by ${newGauge - this._maxCartridges}.`);
        }
        if (newGauge < 0) {
            console.warn(`[GNB Sim] Used ${this._baseCartridges - newGauge} cartridges when you only have ${this._baseCartridges}.`);
        }
        this._baseCartridges = Math.max(Math.min(newGauge, this._maxCartridges), 0);
    }

    set bonusCartridges(newGauge: number) {
        this._bonusCartridges = newGauge;
    }

    useCarts(numberToRemove: number) {
        if (this._bonusCartridges >= numberToRemove) {
            this.bonusCartridges -= numberToRemove;
            return;
        }
        else {
            numberToRemove = numberToRemove - this._bonusCartridges;
            this._bonusCartridges = 0;
        }
        this.cartridges -= numberToRemove;
    }

    getGaugeState(): GnbGaugeState {
        return {
            maxCartridges: this.maxCartridges,
            cartridges: this.cartridges,
        };
    }
}
