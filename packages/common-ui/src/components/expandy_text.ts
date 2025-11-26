import {makeActionButton, quickElement} from "./util";

/**
 * Expandable text area. Truncates with a "Show More" button.
 *
 * You MUST set the CSS variable --truncatable-line-clamp. This sets the maximum number of lines
 * which can be displayed.
 */
export class ExpandableText extends HTMLElement {

    private readonly inner: HTMLDivElement;
    private ro: ResizeObserver | undefined;
    private expanded: boolean = false;

    constructor() {
        super();
        this.inner = quickElement('div', ['truncatable-text-area-inner'], []);
        const expandButton = makeActionButton('Show More', () => {
            this.expanded = true;
            this.checkHeight();
        });
        expandButton.classList.add('truncation-expand-button');

        this.replaceChildren(this.inner, expandButton);
    }

    setChildren(children: Parameters<ParentNode['replaceChildren']>) {
        this.inner.replaceChildren(...children);
    }

    private checkHeight(): void {
        this.classList.toggle('truncated', !this.expanded && this.inner.clientHeight < this.inner.scrollHeight);
    }

    // noinspection JSUnusedGlobalSymbols - part of custom element lifecycle API
    connectedCallback() {
        this.classList.add('truncated');
        if (this.ro !== undefined) {
            this.ro.disconnect();
        }
        const outer = this;
        // The RO will fire on initial element sizing. If we do this prematurely, it could initially see both
        // a clientHeight and scrollHeight of 0 and prematurely expand the element.
        this.ro = new ResizeObserver((e, o) => {
            outer.checkHeight();
        });
        this.ro.observe(this.inner);
    }

    // noinspection JSUnusedGlobalSymbols - part of custom element lifecycle API
    disconnectedCallback() {
        this.ro?.disconnect();
        this.ro = undefined;
    }
}

customElements.define('expandable-text', ExpandableText);
