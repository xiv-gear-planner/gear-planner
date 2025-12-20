export type DropdownAction = {
    label: string,
    action: () => void
}

class DropdownActionItem extends HTMLOptionElement {
    private readonly action: () => void;
    constructor(action: DropdownAction) {
        super();
        this.textContent = action.label;
        this.action = action.action;
    }

    doAction() {
        this.action();
    }
}

function isAction(item: HTMLOptionElement): item is DropdownActionItem {
    return 'doAction' in item;
}

export class DropdownActionMenu extends HTMLSelectElement {
    constructor(private label: string, actions: DropdownAction[] = []) {
        super();
        const placeholder = document.createElement('option');
        placeholder.label = label;
        placeholder.disabled = true;
        this.add(placeholder);
        this.reset();
        actions.forEach(action => this.addAction(action));
        this.addEventListener('change', e => {
            e.stopPropagation();
            e.preventDefault();
            for (const selectedOption of this.selectedOptions) {
                if (isAction(selectedOption)) {
                    setTimeout(() => selectedOption.doAction());
                }
            }
            // setTimeout(() => this.reset());
            this.reset();
        });
    }

    private reset() {
        this.selectedIndex = 0;
    }

    addAction(action: DropdownAction) {
        this.add(new DropdownActionItem(action));
        this.reset();
    }
}

customElements.define('dropdown-action-menu', DropdownActionMenu, {extends: 'select'});
customElements.define('dropdown-action-item', DropdownActionItem, {extends: 'option'});
