export function stringToParagraphs(text: string): HTMLParagraphElement[] {
    return text.trim().split('\n').map(line => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
    });
}

export function textWithToolTip(text: string, tooltip: string): HTMLElement {
    const span = document.createElement('span');
    span.textContent = text;
    span.title = tooltip;
    return span;
}
