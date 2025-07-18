export class LoadingBlocker extends HTMLElement {
    constructor() {
        super();
        this.classList.add("loading-blocker");
        const loadingSpinner = document.createElement("div");
        loadingSpinner.classList.add("loading-spinner");
        const count = 12;
        const animBasis = 1.0;
        for (let i = 0; i < count; i++) {
            const spinnerPart = document.createElement("div");
            const rotation = (i / count * 360);
            const animDelay = (i / count * animBasis) - animBasis;
            spinnerPart.style.transform = `rotate(${rotation}deg)`;
            spinnerPart.style.animationDelay = `${animDelay}s`;
            spinnerPart.style.animationDuration = `${animBasis}s`;
            // spinnerPart.textContent = "foo";
            loadingSpinner.appendChild(spinnerPart);
        }
        this.appendChild(loadingSpinner);
    }

    hide() {
        this.style.display = 'none';
    }

    show() {
        this.style.display = 'block';
    }

    isVisible() {
        return this.style.display !== 'none';
    }
}

customElements.define("loading-blocker", LoadingBlocker);
