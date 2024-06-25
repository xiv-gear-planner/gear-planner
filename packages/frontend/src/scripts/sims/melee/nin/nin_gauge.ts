import {CycleSimResult, DisplayRecordFinalized} from '@xivgear/core/sims/cycle_sim';
import {NinkiAbility} from './nin_types';
import {CustomColumnSpec} from '../../../tables';

export type NINGaugeState = {
    level: number,
    ninki: number,
    kazematoi: number,
};

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
        this._kazematoi = Math.max(Math.min(newGauge, 5), 0);
    }

    getGaugeState(): NINGaugeState {
        return {
            level: this.level,
            ninki: this.ninkiGauge,
            kazematoi: this.kazematoi,
        }
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        // TODO: implementation
        console.log("[Temp] Results", result);
        return [];
    }
}

export default NINGauge;