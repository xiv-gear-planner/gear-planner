/**
 * Class to trigger an action a certain amount of time after it has been 'pinged' - but only if it hasn't been pinged
 * again since.
 */
export class Inactivitytimer {

    private counter: number = 0;
    private readonly _inactivityTimeMs: number;
    private readonly onInactivity: () => void;

    constructor(inactivityTimeMs: number, onInactivity: () => void) {
        this._inactivityTimeMs = inactivityTimeMs;
        this.onInactivity = onInactivity;

    }

    ping() {
        // console.debug('ping');
        this.counter++;
        const expectedCount = this.counter;
        setTimeout(() => {
            this.pingAfter(expectedCount);
        }, this._inactivityTimeMs)
    }

    private pingAfter(exectedCount: number) {
        // console.debug('pingafter', exectedCount, this.counter);
        if (this.counter === exectedCount) {
            this.onInactivity();
        }
    }
}