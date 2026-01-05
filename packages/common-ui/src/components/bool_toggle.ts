import {el, labelFor} from "./util";

export class BoolToggle extends HTMLElement {
    constructor(underlyingInput: HTMLInputElement, trueText: string, falseText: string) {
        super();
        this.classList.add('bool-toggle');
        this.appendChild(underlyingInput);
        const label = labelFor('', underlyingInput);
        label.classList.add('bool-toggle-label');

        const sliderDiv = el('div', {class: 'bool-toggle-slider'});
        const leftText = el('div', {class: 'bool-toggle-left'}, [falseText]);
        const rightText = el('div', {class: 'bool-toggle-right'}, [trueText]);
        const innerDiv = el('div', {class: 'bool-toggle-inner'}, [sliderDiv, leftText, rightText]);

        label.appendChild(innerDiv);

        this.appendChild(label);
    }
}

customElements.define('bool-toggle', BoolToggle);
