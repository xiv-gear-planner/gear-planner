import {makeActionButton, quickElement} from "./util";

/**
 * Expandable text area. Truncates with a "Show More" button.
 *
 * You MUST set the CSS variable --truncatable-line-clamp.
 */
export class ExpandableText extends HTMLElement {
    private inner: HTMLDivElement;
    constructor() {
        super();
        this.inner = quickElement('div', ['truncatable-text-area-inner'], []);
        const ro = new ResizeObserver((e, o) => {
            e.forEach(entry => {
                if (entry.target === this) {
                    if (this.clientHeight < this.scrollHeight) {
                        this.classList.add('truncated');
                    }
                    else {
                        this.classList.remove('truncated');
                    }
                }
            });
        });
        const expandButton = makeActionButton('Show More', () => {
            this.classList.add('expanded');
        });
        expandButton.classList.add('truncation-expand-button');
        ro.observe(this);
        this.replaceChildren(this.inner, expandButton);
    }

    setChildren(children: Parameters<ParentNode['replaceChildren']>) {
        this.inner.replaceChildren(...children);
    }
}

customElements.define('expandable-text', ExpandableText);