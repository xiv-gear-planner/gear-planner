# Quick Debugging Tips

On top of the usual debugging tools available in any web app frontend, there are additional debugging facilities
specific to Xivgear. These are accessible from your browser's Javascript console.

## Builtin Global Variables

The special global variables `currentGearSet` and `currentSheet` refer to the currently-selected gear set and sheet
respectively.

For example, in the console, you can run `currentGearSet.computedStats` to see the entire stats object, including
values that would not otherwise be displayed on the UI.

## Debugging Any Table

You can also get the underlying data item for any tabular data, including items, food, and more.

For example, let's say you want to check computed values for a gear set using this method instead of the above. 

1. Start by using 'inspect element' on the row corresponding to that set on the sets table. 
2. Then, make sure you have the `<tr>` element selected, rather than a `<td>`. 
3. Right-click on the element and select 'Use in console' or your browser's equivalent.
4. This should open the debug console, and pre-fill the input with `temp0` (or `temp1`, `temp2`, etc)
5. Run the command `temp0.dataItem`. You can see all properties of the underlying data item for that row.
6. You can inspect other fields as well. For example, `temp0.dataItem.computedStats` will show all of computed
and intermediate states of that set.
7. To execute a function, e.g. to calcuate a GCD for a 3.5s GCD, you can call functions with the syntax
`temp0.dataItem.computedStats.gcdMag(3.5)` (or `gcdPhys`).

This works on other tables as well, such as item picker tables.

This also works for table cells (`<td>` elements), but instead of `.dataItem`, use `._cellValue`.