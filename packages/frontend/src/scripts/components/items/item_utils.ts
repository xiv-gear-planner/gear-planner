import {DISPLAY_SETTINGS} from "@xivgear/common-ui/settings/display_settings";

/**
 * Sort items in-place by their ilvl. Respects the user-facing reverse item sort setting.
 *
 * @param items The list. Will be mutated in-place.
 */
export function sortItemsInPlace<X extends {
    ilvl: number
}>(items: X[]): void {
    items.sort((left, right) => left.ilvl - right.ilvl);
    if (DISPLAY_SETTINGS.reverseItemSort) {
        items.reverse();
    }
}
