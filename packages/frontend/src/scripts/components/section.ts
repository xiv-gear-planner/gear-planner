export class NamedSection extends HTMLElement {
    private readonly header: HTMLHeadingElement;
    private readonly _contentArea: HTMLDivElement;
    constructor(title: string | null = null, invertInputColors: boolean = true) {
        super();
        this.classList.add('named-section');
        if (invertInputColors) {
            this.classList.add('invert-input-colors');
        }
        this.header = document.createElement('h3');
        this.header.classList.add('named-section-header');
        this._contentArea = document.createElement('div');
        this._contentArea.classList.add('named-section-content-area');
        this.titleText = title;
        this.replaceChildren(this.header, this._contentArea);
    }
    get titleText(): string {
        return this.header.textContent;
    }

    set titleText(value: string | null) {
        if (value !== null) {
            this.header.textContent = value;
            this.header.style.display = '';
        }
        else {
            this.header.textContent = '';
            this.header.style.display = 'none';
        }
    }

    get contentArea() {
        return this._contentArea;
    }
}

customElements.define('named-section', NamedSection);
