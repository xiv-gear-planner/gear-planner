import {BaseModal} from "@xivgear/common-ui/components/modal";
import {el} from "@xivgear/common-ui/components/util";

/**
 * Shows a dialog when a webpack chunk (or in future, a web worker script) fails to load.
 * Gives the user the option to reload the page (with cache bust) or continue without the failed feature.
 */
export function showChunkLoadErrorDialog(): void {
    new ChunkLoadErrorModal().attachAndShowExclusively();
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class ChunkLoadErrorModal extends BaseModal {
    private reloadButton: HTMLButtonElement;
    private cancelled = false;

    constructor() {
        super();
        this.headerText = 'Error Loading Page';
        const description = el('p', {}, [
            'A required script failed to load. Reloading the page usually fixes this. You can check the browser console for more details.',
            el('br'),
            'The page will automatically reload in 10 seconds.',
        ]);
        this.contentArea.appendChild(description);
        this.reloadButton = this.addActionButton('Reload (9)', () => this.reload());
        this.addCloseButton('Continue Anyway');
        this.runCountdownLoop();
    }

    private async runCountdownLoop(): Promise<void> {
        const targetTime = Date.now() + 10_000;
        while (true) {
            const remainingMs = targetTime - Date.now();
            if (remainingMs <= 0) {
                this.reload();
                return;
            }
            const waitMs = remainingMs % 1000 || 1000;
            await delay(waitMs);
            if (this.cancelled) {
                return;
            }
            const remainingAfterWait = targetTime - Date.now();
            const displaySeconds = Math.max(0, Math.min(10, Math.floor(remainingAfterWait / 1000)));
            this.reloadButton.textContent = `Reload (${Math.min(9, displaySeconds)})`;
        }
    }

    protected onClose(): void {
        this.cancelled = true;
    }

    private reload(): void {
        const url = new URL(document.location.toString());
        url.searchParams.set('_cacheBust', Math.floor(Math.random() * 1_000_000).toString());
        window.location.href = url.toString();
    }

    get explicitCloseOnly(): boolean {
        return true;
    }
}

customElements.define("chunk-load-error-modal", ChunkLoadErrorModal);
