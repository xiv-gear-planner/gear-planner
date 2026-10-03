export {};

// LinkeDOM does not export its HTMLDocument class for module augmentation. Model the
// createElement signature expected by the preview server on the global HTMLDocument.
declare global {
    interface HTMLDocument {
        createElement<K extends keyof HTMLElementTagNameMap>(localName: K, options?: ElementCreationOptions): HTMLElementTagNameMap[K];
        createElement(localName: string, options?: ElementCreationOptions): HTMLElement;
    }
}
