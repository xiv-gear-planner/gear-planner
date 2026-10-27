import {DISPLAY_SETTINGS} from "@xivgear/common-ui/settings/display_settings";

/**
 * Sort items in-place by their ilvl, using item id as a tiebreaker. Respects the user-facing reverse item sort setting.
 *
 * @param items The list. Will be mutated in-place.
 */
export function sortItemsInPlace<X extends {
    ilvl: number
    id: number
}>(items: X[]): void {
    items.sort((left, right) => (left.ilvl - right.ilvl) || (left.id - right.id));
    if (DISPLAY_SETTINGS.reverseItemSort) {
        items.reverse();
    }
}
