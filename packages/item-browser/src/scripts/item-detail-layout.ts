/**
 * Given an item details grid, adjust the transform on each card so that the cards are vertically packed together.
 * In other words, it's like CSS grid masonry, but masonry has little to no browser support at this time.
 *
 * @param container The container to adjust.
 */
function layout(container: HTMLElement): void {
    const cards = Array.from(container.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
    );
    // Clear existing transforms
    cards.forEach(card => card.style.transform = '');

    const columns = new Map<number, HTMLElement[]>();
    cards.forEach(card => {
        const left = Math.round(card.getBoundingClientRect().left);
        const column = columns.get(left) ?? [];
        column.push(card);
        columns.set(left, column);
    });

    columns.forEach(column => {
        column.sort((a, b) => a.offsetTop - b.offsetTop);
        let previousBottom = 0;
        column.forEach((card, index) => {
            const rect = card.getBoundingClientRect();
            const top = card.offsetTop;
            const targetTop = index === 0 ? top : previousBottom + 20;
            if (targetTop !== top) {
                const offset = targetTop - top;
                card.style.transform = `translateY(${offset}px)`;
            }
            previousBottom = targetTop + rect.height;
        });
    });
}

const observer = new ResizeObserver(entries => {
    entries.forEach(entry => {
        if (entry.target instanceof HTMLElement) {
            layout(entry.target as HTMLElement);
        }
    });
});

/**
 * Upon calling this, it will both do the layout adjustment, as well as install a ResizeObserver onto every applicable
 * element which will re-check the layout upon resize.
 */
function observeAll(): void {
    observer.disconnect();

    document.querySelectorAll<HTMLElement>('.item-detail-main').forEach(container => {
        observer.observe(container);
        layout(container);
    });
}

export function recheckNow() {
    document.querySelectorAll<HTMLElement>('.item-detail-main').forEach(container => {
        layout(container);
    });
}

/**
 * Recheck on initial load as well as whenever we do HTMX things.
 */
document.addEventListener('DOMContentLoaded', observeAll);
document.addEventListener('htmx:load', observeAll);
document.addEventListener('htmx:afterSwap', observeAll);
