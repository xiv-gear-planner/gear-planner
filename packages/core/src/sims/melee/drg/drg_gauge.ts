import {GaugeManager} from "@xivgear/core/sims/cycle_sim";
import {DrgGaugeState} from "./drg_types";

export class DrgGaugeManager implements GaugeManager<DrgGaugeState> {

    private _level: number;
    private _firstmindsFocus: number = 0;

    constructor(level: number) {
        this._level = level;
    }

    get level(): number {
        return this._level;
    }

    get firstmindsFocus(): number {
        return this._firstmindsFocus;
    }

    set firstmindsFocus(newFirstmindsFocus: number) {
        // This gauge only exists at level 90 and above.
        if (this.level < 90) {
            return;
        }

        if (newFirstmindsFocus > 2) {
            console.warn(`[DRG Sim] Overcapped Firstminds' Focus.`);
        }
        if (newFirstmindsFocus < 0) {
            console.warn(`[DRG Sim] Used Firstminds' Focus with no charge.`);
        }
        this._firstmindsFocus = Math.max(Math.min(newFirstmindsFocus, 2), 0);
    }

    gainFirstmindsFocus() {
        this.firstmindsFocus += 1;
    }

    gaugeSnapshot(): DrgGaugeState {
        return {
            level: this.level,
            firstmindsFocus: this.firstmindsFocus,
        };
    }
}
