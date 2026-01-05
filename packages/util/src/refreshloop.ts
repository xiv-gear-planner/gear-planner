export class RefreshLoop {

    private readonly callback: () => Promise<void>;
    private readonly timeoutProvider: () => number;
    private currentTimer: number | null = null;

    constructor(callback: () => Promise<void>, timeout: () => number) {
        this.callback = callback;
        this.timeoutProvider = timeout;
    }

    start(): void {
        if (this.currentTimer === null) {
            this.scheduleNext();
        }
    }

    async startAndRunOnce(): Promise<void> {
        await this.refresh();
    }

    stop(): void {
        if (this.currentTimer !== null) {
            clearTimeout(this.currentTimer);
            this.currentTimer = null;
        }
    }

    get timeout(): number {
        return this.timeoutProvider();
    }

    async refresh(): Promise<void> {
        this.stop();
        try {
            await this.callback();
        }
        catch (e) {
            console.error("Error refreshing", e);
        }
        this.scheduleNext();
    }

    private scheduleNext(): void {
        const to = this.timeout;
        this.currentTimer = window.setTimeout(() => this.refresh(), to);
    }
}
