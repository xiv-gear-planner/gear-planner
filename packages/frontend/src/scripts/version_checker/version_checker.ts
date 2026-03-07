// Helpers to offer to refresh the site when a new version is detected.

import {showNewVersionModal} from "./new_version_modal";

export interface VersionPollerConfig {
    intervalMs: number;
    requiredConsecutiveChanges: number;
    fetchFn: (url: URL) => Promise<Response>;
    getRemoteUrl: () => URL;
    getCurrentDocument: () => Document;
    onDetected: () => void;
}

const DEFAULT_CONFIG = {
    intervalMs: 60_000,
    requiredConsecutiveChanges: 3,
    fetchFn: (url: URL) => fetch(url, {credentials: "same-origin"}),
    getRemoteUrl: () => {
        return new URL("index.html", window.location.href);
    },
    getCurrentDocument: () => document,
    onDetected: () => null,
} as const satisfies VersionPollerConfig;

/**
 * Helper to check if there is a new version of the site available.
 */
export class VersionChecker {

    /**
     * Configuration for this poller. Highly customizable since unit testing would be a PITA otherwise.
     * @private
     */
    private readonly config: VersionPollerConfig;
    /**
     * The version of the main script from the actual loaded page.
     * @private
     */
    private baselineMainSrc: string | null = null;
    /**
     * The number of consecutive times the main script has been seen as different from what is on the page.
     * We require multiple consecutive mismatches to avoid situations where the page has already loaded with the new
     * version, but happens to see an old version once due to slow pod rollover or outdated caches.
     * @private
     */
    private consecutiveDiffs = 0;
    /**
     * Detected a diff enough times and fired the desired action. Once the user declines to reload once, don't nag them again.
     * @private
     */
    private fired = false;
    /**
     * Whether this is already running. Causes subsequent calls to start() to be ignored.
     * @private
     */
    private running = false;

    constructor(configOverrides: Partial<VersionPollerConfig> = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...configOverrides,
        };
    }

    start(): void {
        if (this.running) {
            return;
        }
        void this.run();
    }

    private async delayMs(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async delay(): Promise<void> {
        return this.delayMs(this.config.intervalMs);
    }

    private async run(): Promise<void> {
        this.running = true;
        const cfg = this.config;

        // Wait initially, no need to cause extra network traffic/CPU while page is still initially loading
        await this.delay();

        // Read the current document
        const doc = cfg.getCurrentDocument();
        const remoteUrl = cfg.getRemoteUrl();

        this.baselineMainSrc = this.getMainScriptSrcFromDocument(doc, remoteUrl);
        if (!this.baselineMainSrc) {
            return;
        }

        while (!this.fired) {
            try {
                const res = await cfg.fetchFn(remoteUrl);
                if (res.ok) {
                    const html = await res.text();
                    const remoteMain = this.getMainScriptSrcFromHtml(html, remoteUrl);
                    console.debug(`scripts: ${this.baselineMainSrc} => ${remoteMain}`);
                    if (remoteMain) {
                        if (remoteMain === this.baselineMainSrc) {
                            this.consecutiveDiffs = 0;
                        }
                        else {
                            this.consecutiveDiffs++;
                            console.log(`scripts: ${this.baselineMainSrc} => ${remoteMain}. Consecutive diffs: ${this.consecutiveDiffs}`);
                            if (this.consecutiveDiffs >= cfg.requiredConsecutiveChanges) {
                                this.fired = true;
                                cfg.onDetected?.();
                                break;
                            }
                        }
                    }
                }
                else {
                    console.warn(`Failed to fetch remote version from ${remoteUrl}`, res);
                }
            }
            catch {
                // ignore errors - wait then try again
            }

            if (this.fired) {
                break;
            }
            if (this.consecutiveDiffs > 0) {
                console.log("consecutiveDiffs", this.consecutiveDiffs);
            }
            await this.delay();
        }
        this.running = false;
    }

    /**
     * Get the main script full path from the given document.
     * @param doc The document to extract from.
     * @param baseUrl The base URL, used to make sure we don't look at third party scripts.
     * @private
     */
    private getMainScriptSrcFromDocument(doc: Document, baseUrl: URL): string | null {
        const scripts = doc.querySelectorAll<HTMLScriptElement>("head > script[src]");
        for (const script of scripts) {
            const src = script.src;
            if (!src) {
                continue;
            }
            try {
                const url = new URL(src, baseUrl);
                if (url.hostname === baseUrl.hostname && url.pathname.includes("main") && url.pathname.endsWith(".js")) {
                    return url.toString();
                }
            }
            catch {
                // ignore malformed URLs
            }
        }
        return null;
    }

    private getMainScriptSrcFromHtml(html: string, baseUrl: URL): string | null {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        return this.getMainScriptSrcFromDocument(doc, baseUrl);
    }
}

export function setupVersionChecker() {
    new VersionChecker({
        onDetected: () => showNewVersionModal(),
    }).start();
}
