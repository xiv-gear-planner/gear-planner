import {SAMGaugeState, KenkiAbility} from './sam_types';

class SAMGauge {
    constructor(level: number) {
        this._level = level;
    }

    private _level: number;
    get level() {
        return this._level;
    }

    private _kenkiGauge: number = 0;
    get kenkiGauge() {
        return this._kenkiGauge;
    }
    set kenkiGauge(newGauge: number) {
        if (newGauge > 100) {
            console.warn(`[SAM Sim] Overcapped Kenki by ${newGauge - 100}.`);
        }
        this._kenkiGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    spendKenki(action: KenkiAbility): void {
        action.updateGaugeLegacy(this);
    }

    private _meditation: number = 0;
    get meditation() {
        return this._meditation;
    }
    set meditation(newGauge: number) {
        this._meditation = Math.max(Math.min(newGauge, 3), 0);
    }

    spendMeditation(): void {
        this.meditation = 0;
    }

    private _sen: Set<string> = new Set<string>();
    get sen() {
        return this._sen;
    }
    set sen(newSen: Set<string>) {
        this._sen = newSen;
    }

    addSen(newSen: string): void {
        this._sen.add(newSen);
    }
    spendSen(): void {
        this._sen.clear();
    }

    getGaugeState(): SAMGaugeState {
        return {
            level: this.level,
            sen: new Set([...this.sen]),
            kenki: this.kenkiGauge,
            meditation: this.meditation,
        };
    }
}

export default SAMGauge;
