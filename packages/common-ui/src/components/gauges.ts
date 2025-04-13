export class GaugeWithText<X> extends HTMLElement {

    private readonly bar: GaugeBar<X>;
    private readonly label: HTMLSpanElement;

    constructor(barColorFunc: (val: X) => Color, private readonly labelFormat: (val: X) => string, toPercent: (val: X) => number) {
        super();
        this.bar = new GaugeBar(barColorFunc, toPercent);
        this.label = document.createElement('span');
        this.replaceChildren(this.bar, this.label);
    }

    setDataValue(value: X) {
        this.label.textContent = this.labelFormat(value);
        this.bar.setDataValue(value);
    }
}

type Color = CSSStyleDeclaration['backgroundColor']

export class GaugeBar<X> extends HTMLElement {

    private readonly inner: HTMLDivElement;

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
customElements.define('gauge-bar', GaugeBar);
