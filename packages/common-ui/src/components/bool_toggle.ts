import {labelFor} from "./util";

export class BoolToggle extends HTMLElement {
    constructor(underlyingInput: HTMLInputElement, trueText: string, falseText: string) {
        super();
        this.classList.add('bool-toggle');
        this.appendChild(underlyingInput);
        const label = labelFor('', underlyingInput);
        label.classList.add('bool-toggle-label');

        const innerDiv = document.createElement('div');
        innerDiv.classList.add('bool-toggle-inner');
        const sliderDiv = document.createElement('div');
        sliderDiv.classList.add('bool-toggle-slider');
        const leftText = document.createElement('div');
        leftText.classList.add('bool-toggle-left');
        const rightText = document.createElement('div');
        rightText.classList.add('bool-toggle-right');

        leftText.textContent = falseText;
        rightText.textContent = trueText;

        innerDiv.replaceChildren(sliderDiv, leftText, rightText);

        label.appendChild(innerDiv);

        this.appendChild(label);
    }
}

customElements.define('bool-toggle', BoolToggle);
