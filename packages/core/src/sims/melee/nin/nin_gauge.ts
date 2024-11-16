import {NINGaugeState, NinkiAbility} from './nin_types';

class NINGauge {
    constructor(level: number) {
        this._level = level;
    }

    private _level: number;
    get level() {
        return this._level;
    }

    private _ninkiGauge: number = 0;
    get ninkiGauge() {
        return this._ninkiGauge;
    }
    set ninkiGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Ninki by ${newGauge - 100}.`);
        }
        else if (newGauge < 0) {
            console.error(`Used ${this.ninkiGauge - newGauge} Ninki when you only have ${this.ninkiGauge}.`);
        }
        this._ninkiGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    spendNinki(action: NinkiAbility): void {
        action.updateGauge(this);
    }

    ninkiReady(): boolean {
        return this.ninkiGauge >= 50;
    }

    private _kazematoi: number = 0;
    get kazematoi() {
        return this._kazematoi;
    }
    set kazematoi(newGauge: number) {
        if (newGauge > 5) {
            console.warn(`Overcapped Kazematoi by ${newGauge - 5}.`);
        }
        else if (newGauge < 0) {
            console.error(`Used ${this.kazematoi - newGauge} Kazematoi when you only have ${this.kazematoi}.`);
        }
        this._kazematoi = Math.max(Math.min(newGauge, 5), 0);
    }

    getGaugeState(): NINGaugeState {
        return {
            level: this.level,
            ninki: this.ninkiGauge,
            kazematoi: this.kazematoi,
        };
    }
}

export default NINGauge;
