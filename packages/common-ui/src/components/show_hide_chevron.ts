import {makeChevronDown} from "./icons";

export type ShowHideCallback = (newState: boolean, clickCount: number) => void;

/**
 * A button that is intended to show/hide something when clicked. When hidden, the 'hidden' class is applied to itself.
 * This should not be used to hide this button itself, but rather used to hide some other element. You can also utilize
 * the callback if you want to use a mechanism other than CSS for this.
 */
export class ShowHideButton extends HTMLElement {
    private _hidden: boolean;

    /**
     * Creates a new ShowHideButton.
     * @param initiallyHidden Whether the button is initially in the hidden state.
     * @param callback A callback that is called when the button is clicked.
     * The parameters are whether the button is hidden or shown (after processing the click event), and the click count,
     * allowing you to add additional behavior to 2+ clicks (e.g. hiding multiple similar elements).
     */
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
