export function scrollIntoView(element: Element) {
    element.scrollIntoView({
        behavior: 'instant',
        block: 'nearest'
    });
}
