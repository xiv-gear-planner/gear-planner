import {makeChevronDown} from "./util";

export class ShowHideButton extends HTMLElement {
    private _hidden: boolean;

    constructor(initiallyHidden: boolean = false, private setter: (newValue: boolean) => void) {
        super();
        this._hidden = initiallyHidden;
        this.appendChild(makeChevronDown());
        this.setStyles();
    }

    get isHidden(): boolean {
        return this._hidden;
    }

    set isHidden(hide: boolean) {
        this._hidden = hide;
        this.setStyles();
        this.setter(hide);
    }

    toggle(): void {
        this.isHidden = !this.isHidden;
    }

    private setStyles() {
        if (this.isHidden) {
            this.classList.add('hidden');
        } else {
            this.classList.remove('hidden');
        }
    }
}
customElements.define("show-hide-button", ShowHideButton);
