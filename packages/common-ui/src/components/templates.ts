import {el, ElOpts} from "./util";

export type StringTemplate<In, Out> = (template: readonly string[], ...substitutions: In[]) => Out;

// Only include types that have user-friendly default string representations, or are nodes.
// No functions, no classes without a toString method, etc.
export type ElementTemplateInputs = Node | string | number | bigint | {
    toString: () => string,
    // Require some other property to differentiate against functions
    [key: string]: unknown,
};

export type ElementTemplate<Out extends HTMLElement> = StringTemplate<ElementTemplateInputs, Out>;

// attempt at using tagged templates to do strings
export function elt<X extends keyof HTMLElementTagNameMap>(tag: X, opts: ElOpts<X> = {}): ElementTemplate<HTMLElementTagNameMap[X]> {
    return (strings: readonly string[], ...args: unknown[]) => {
        const out = processElementTemplate(strings, args);
        return el(tag, opts, out);
    };
}

function processElementTemplate(strings: readonly string[], ...args: unknown[]): (string | Node)[] {
    const out: Parameters<ParentNode['replaceChildren']> = [];
    out.push(strings[0]);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (typeof arg === 'string' || arg instanceof Node) {
            out.push(arg);
        }
        else {
            out.push(String(arg));
        }
        out.push(strings[i + 1]);
    }
    return out;
}

/**
 * Like elt, but just returns a list of children rather than creating an element.
 */
export const cht: StringTemplate<ElementTemplateInputs, (Node | string)[]> = processElementTemplate;

export const bold = elt('b');
export const p = elt('p');
