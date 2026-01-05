import {BaseModal} from "@xivgear/common-ui/components/modal";
import {quickElement} from "@xivgear/common-ui/components/util";
import {AccountStateTracker} from "../account_state";

export class LogoutModal extends BaseModal {
    constructor(tracker: AccountStateTracker, after: () => void) {
        super();
        this.headerText = 'Logout';
        const text = quickElement('p', [], ['You can choose to log out but keep all data locally, or erase local data.']);
        this.contentArea.replaceChildren(text);
        this.addActionButton('Logout and Keep Data', ev => this.showLoadingBlockerWhile(async () => {
            await tracker.logout(false);
            this.close();
            after();
        }));
        this.addActionButton('Logout and Erase Data', ev => this.showLoadingBlockerWhile(async () => {
            await tracker.logout(true);
            this.close();
            after();
        }));
        this.addCloseButton('Cancel');
    }
}

customElements.define('logout-modal', LogoutModal);
