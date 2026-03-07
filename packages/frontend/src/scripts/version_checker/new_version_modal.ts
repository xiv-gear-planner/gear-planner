import {BaseModal} from "@xivgear/common-ui/components/modal";
import {el} from "@xivgear/common-ui/components/util";

export function showNewVersionModal() {
    new NewVersionModal().attachAndShowTop();
}

// TODO: maybe make this not have the usual modal backdrop + keep it at the top? Might make it less annoying if it pops up.
/**
 * Modal to inform the user that a new version of the site is available.
 */
export class NewVersionModal extends BaseModal {
    constructor() {
        super();
        this.headerText = 'New Version Available';
        const description = el('p', {}, [
            'A new version of the site is available. We recommend you reload the page.',
        ]);
        this.contentArea.append(description);
        this.addActionButton('Reload', () => this.reload());
        this.addCloseButton('Close');
    }

    private reload(): void {
        const url = new URL(document.location.toString());
        // Like the early reload-on-error and ChunkLoadErrorModal, use a random _cacheBust param to bypass caching.
        url.searchParams.set('_cacheBust', Math.floor(Math.random() * 1_000_000).toString());
        window.location.href = url.toString();
    }
}

customElements.define('new-version-modal', NewVersionModal);
