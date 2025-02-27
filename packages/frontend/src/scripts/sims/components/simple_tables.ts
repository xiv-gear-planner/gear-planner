import {CustomTable} from "@xivgear/common-ui/table/tables";
import {camel2title} from "@xivgear/util/strutils";

import {SimResult} from "@xivgear/core/sims/sim_types";

type SimpleResultEntry = {
    name: string;
    value: NonNullable<unknown>;
}

export function bestEffortFormat(value: unknown): Node {
    if (typeof value === 'number') {
        return document.createTextNode(value.toFixed(3));
    }
    else {
        return document.createTextNode(value.toString());
    }
}

/**
 * Simple table for displaying key/value pairs of an object. The left column is the
 * keys, while the right column is the values. No header row.
 *
 * @param result The result to display
 */
export function simpleAutoResultTable(result: object): HTMLElement {
    const data: SimpleResultEntry[] = [];
    for (const fieldKey in result) {
        data.push({
            name: camel2title(fieldKey),
            value: result[fieldKey],
        });
    }
    const table = new CustomTable<SimpleResultEntry>();
    table.columns = [
        {
            shortName: 'key',
            displayName: 'Key',
            getter: item => item.name,
        },
        {
            shortName: 'value',
            displayName: 'Value',
            getter: item => item.value,
            renderer: bestEffortFormat,
        },
    ];
    table.data = data;
    return table;

}

export function simpleMappedResultTable<X extends SimResult>(fieldNames: { [K in keyof X]: string }): ((result: X) => HTMLElement) {
    return (result: X): HTMLElement => {
        const data: SimpleResultEntry[] = [];
        for (const fieldKey in fieldNames) {
            data.push({
                name: fieldNames[fieldKey],
                value: result[fieldKey],
            });
        }
        const table = new CustomTable<SimpleResultEntry>();
        table.columns = [
            {
                shortName: 'key',
                displayName: 'Key',
                getter: item => item.name,
            },
            {
                shortName: 'value',
                displayName: 'Value',
                getter: item => item.value,
                renderer: bestEffortFormat,
            },
        ];
        table.data = data;
        return table;
    };
}
