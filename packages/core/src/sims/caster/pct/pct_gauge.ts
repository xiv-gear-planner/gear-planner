import {PctPaletteAbility, PCTGaugeState, PctPaintAbility} from './pct_types';

class PCTGauge {
    constructor(level: number) {
        this._level = level;
    }
    private _level: number;
    get level() {
        return this._level;
    }

    private _paletteGauge : number = 0;
    get paletteGauge() {
        return this._paletteGauge;
    }

    set paletteGauge(newGauge : number) {
        if (newGauge > 100) {
            console.warn(`Overcapped Palette by ${newGauge - 100}.`);
        }
        else if (newGauge < 0) {
            console.error(`Used ${this.paletteGauge - newGauge} Palette when you only have ${this.paletteGauge}.`);
        }
        this._paletteGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    spendPalette(action: PctPaletteAbility) : void {
        action.updateGauge(this);
    }

    paletteReady(): boolean {
        return this.paletteGauge >= 50;
    }

    private _whitePaintCharges : number = 0;
    get whitePaintCharges() {
        return this._whitePaintCharges;
    }

    set whitePaintCharges(newGauge: number){
        // Overcapping White Paint is not an issue so no need to check for it.
        if (newGauge < 0) {
            console.error(`No White Paint charges available for use.`);
        }
        this._paletteGauge = Math.max(Math.min(newGauge, 5), 0);
    }

    spendWhitePaint(action: PctPaintAbility) : void {
        action.updateGauge(this);
    }

    private _hyperphantasiaStacks : number = 0;
    get hyperphantasiaStacks() {
        return this._hyperphantasiaStacks;
    }

    set hyperphantasiaStacks(newGauge: number){
        if (newGauge < 0) {
            console.error();
        }
    }

    getGaugeState(): PCTGaugeState {
        return {
            level: this.level,
            palette: this.paletteGauge,
            whitePaint: this.whitePaintCharges,
            hyperphantasia: this.hyperphantasiaStacks,
        };
    }
}

export default PCTGauge;
