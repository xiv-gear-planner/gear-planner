const proc = {
    env: {
        NODE_DEBUG: false
    },
    version: "20.0.1"
};

// @ts-expect-error - process is not available in a browser context
global.process = proc;

class HTMLElement {

}

// @ts-expect-error - ???
global.HTMLElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLOptionElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLSelectElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLInputElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLTableCellElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLTableRowElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLTableElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLImageElement = HTMLElement;
// @ts-expect-error - ???
global.HTMLDivElement = HTMLElement;

const fakeCustomElements: CustomElementRegistry = {
    define(name: string, constructor: CustomElementConstructor, options: ElementDefinitionOptions | undefined): void {
    },
    get(name: string): CustomElementConstructor | undefined {
        return undefined;
    },
    getName(constructor: CustomElementConstructor): string | null {
        return undefined;
    },
    upgrade(root): void {
    },
    whenDefined(name: string): Promise<CustomElementConstructor> {
        return Promise.resolve(undefined);
    }

};

// noinspection JSConstantReassignment
global.customElements = fakeCustomElements;
