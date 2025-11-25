import {makeChevronDown} from "./icons";

export type ShowHideCallback = (newState: boolean, clickCount: number) => void;

export class ShowHideButton extends HTMLElement {
    private _hidden: boolean;

    constructor(initiallyHidden: boolean = false, private callback: ShowHideCallback) {
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
        this.callback(hide, 1);
    }

    toggle(clickCount: number = 1): void {
        if (clickCount === 1) {
            this.isHidden = !this.isHidden;
        }
        else {
            this.callback(this.isHidden, clickCount);
        }
    }

    private setStyles() {
        this.classList.toggle('hidden', this.isHidden);
    }
}
customElements.define("show-hide-button", ShowHideButton);
