export function scrollIntoView(element: Element, block: ScrollLogicalPosition = 'nearest') {
    element.scrollIntoView({
        behavior: 'instant',
        block: 'nearest',
    });
}
