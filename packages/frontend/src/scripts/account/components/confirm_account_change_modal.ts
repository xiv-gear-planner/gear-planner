import {BaseModal} from "@xivgear/common-ui/components/modal";
import {quickElement} from "@xivgear/common-ui/components/util";
import {ResolveReject} from "@xivgear/util/async";

/**
 * Dialog to confirm purging of local data when switching accounts.
 */
export class ConfirmAccountChangeModal extends BaseModal {
    constructor(private readonly promiseOut: ResolveReject<boolean>) {
        super();
        this.headerText = 'Confirm Account Change';
        const text = quickElement('p', [], ['You were previously logged in with a different account. If you continue to log in, local data will be cleared and replaced with data from the new account.']);
        this.contentArea.replaceChildren(text);
        this.addActionButton('Delete Data and Switch', ev => this.showLoadingBlockerWhile(async () => {
            promiseOut.resolve(true);
            this.close();
        }));
        this.addActionButton('Cancel', ev => this.showLoadingBlockerWhile(async () => {
            promiseOut.resolve(false);
            this.close();
        }));
    }

    get explicitCloseOnly(): boolean {
        return true;
    }

    protected onClose() {
        this.promiseOut.resolve(false);
    }
}

customElements.define('confirm-account-change-modal', ConfirmAccountChangeModal);
