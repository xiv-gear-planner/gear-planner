import { VprGaugeState } from "./vpr_types";

export class VprGauge {

    private _serpentOfferings: number = 0;
    get serpentOfferings(): number {
        return this._serpentOfferings;
    }
    set serpentOfferings(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Serpent Offerings by ${newGauge - 100}.`);
        }
        if (newGauge < 0) {
            console.warn(`Used ${this._serpentOfferings - newGauge} when you only have ${this._serpentOfferings}.`);
        }
        this._serpentOfferings = Math.max(Math.min(newGauge, 100), 0);
    }

    private _rattlingCoils: number = 0;
    get rattlingCoils(): number {
        return this._rattlingCoils;
    }
    set rattlingCoils(newCoils: number) {
        if (newCoils > 3) {
            console.warn(`Overcapped Rattling Coils by ${newCoils - 3}.`);
        }
        if (newCoils < 0) {
            console.warn(`Used Rattling coils when empty`);
        }

        this._rattlingCoils = Math.max(Math.min(newCoils, 3), 0);
    }


    getGaugeState(): VprGaugeState {
        return {
            level: 100,
            serpentOfferings: this.serpentOfferings,
            rattlingCoils: this.rattlingCoils,
        };
    }
}
