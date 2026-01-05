import {quickElement} from "./util";

export class GaugeWithText<X> extends HTMLElement {

    private readonly bar: GaugeBar<X>;
    private readonly label: HTMLSpanElement;

    constructor(barColorFunc: (val: X) => Color, private readonly labelFormat: (val: X) => string, toPercent: (val: X) => number) {
        super();
        this.bar = new GaugeBar(barColorFunc, toPercent);
        this.classList.add('gauge-outer');
        this.label = quickElement('span', ['gauge-text-label']);
        this.replaceChildren(this.bar, this.label);
    }

    setDataValue(value: X) {
        this.label.textContent = this.labelFormat(value);
        this.bar.setDataValue(value);
    }
}

export class GaugeNoText<X> extends HTMLElement {

    private readonly bar: GaugeBar<X>;

    constructor(barColorFunc: (val: X) => Color, toPercent: (val: X) => number) {
        super();
        this.bar = new GaugeBar(barColorFunc, toPercent);
        this.classList.add('gauge-outer');
        this.replaceChildren(this.bar);
    }

    setDataValue(value: X) {
        this.bar.setDataValue(value);
    }
}

type Color = CSSStyleDeclaration['backgroundColor']

export class GaugeBar<X> extends HTMLElement {

    private readonly inner: HTMLDivElement;

    /**
     * Create a simple gauge bar with no text.
     *
     * @param {function} barColorFunc A function that maps a value to the fill color for the bar.
     * @param {function} toPercent A function that calculates the percentage value from a given value. Should return
     * a number between 0 and 100.
     */
    constructor(private readonly barColorFunc: (val: X) => Color, private readonly toPercent: (val: X) => number) {
        super();
        this.inner = document.createElement('div');
        this.inner.classList.add('gauge-bar-inner');
        this.appendChild(this.inner);
    }

    setDataValue(value: X) {
        this.inner.style.width = `${this.toPercent(value)}%`;
        this.inner.style.backgroundColor = this.barColorFunc(value);
    }
}

customElements.define('gauge-outer', GaugeWithText);
customElements.define('gauge-outer-textless', GaugeNoText);
customElements.define('gauge-bar', GaugeBar);
