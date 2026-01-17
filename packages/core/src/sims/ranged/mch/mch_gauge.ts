/** Manages the MCH gauges (heat and battery) */
export class MchGauge {
    private _heat: number = 0;
    private _battery: number = 0;

    /** Get the current heat gauge value */
    get heat(): number {
        return this._heat;
    }

    /** Change the heat gauge value, with overcap/misuse management */
    set heat(newHeat: number) {
        if (newHeat > 100) {
            console.warn(`Overcapping heat gauge by ${newHeat - 100}.`);
        }
        if (newHeat < 0) {
            console.warn(`Invalid usage of heat gauge (new value is ${newHeat}).`);
        }
        this._heat = Math.max(Math.min(newHeat, 100), 0);
    }

    /** Get the current battery gauge value */
    get battery(): number {
        return this._battery;
    }

    /** Change the battery gauge value, with overcap/misuse management */
    set battery(newBattery: number) {
        if (newBattery > 100) {
            console.warn(`Overcapping battery gauge by ${newBattery - 100}.`);
        }
        if (newBattery < 0) {
            console.warn(
                `Invalid usage of battery gauge (new value is ${newBattery}).`
            );
        }
        this._battery = Math.max(Math.min(newBattery, 100), 0);
    }
}
