# User's Guide

Welcome to xivgear.app. This short guide will show you how to use XivGear.

## Gear Sheets

Gear sheets are collections of gear sets. They can also have simulations attached to them, to provide DPS estimates
under particular fight lengths and party compositions.

In order to make a gear set, you first start with a sheet.

### Making a New Sheet

To create a new sheet from scratch, 
click 'New Sheet' at the top. You can then select the job, level, and optional item level sync
for the new sheet. 

The sheet will be pre-populated with an empty set and, if the class has one, a simulation.

### Editing a Shared Sheet

You cannot edit a shared sheet, but you can click 'Save As' under the sets table. You can then save it as a sheet of
your own.

You can also click 'Import Sheet' at the top, and paste the sheet URL into it.

### Opening Your Saved Sheets

To open one of your own sheets, you can click 'My Sheets' at the top, and then select the sheet to open.

Note that your sheets are saved in your browser. Nobody else will be able to see your sheets. To share the sheet, you
will need to [export it](#exporting).

## Gear Sets

You can add a gear set to your sheet through any of the following ways:
- Click 'New Gear Set' under the sets table.
- Click 'Import Sets' and paste a xivgear or etro link. Unlike the 'Import' button at the top of the screen, this will
  import into the current sheet, rather than creating a new sheet.
- Click the 'Clone' button on an existing gear set.

To edit a set, simply click it in the table, and edit it on the bottom half of the screen. Between the sets table and
the set editor is the toolbar. You can drag an empty space in the toolbar up or down to move the toolbar around.

To delete a set, click the trash can icon. To drag a set, drag the '≡' icon up or down.

For each gear slot, you can click an item to equip it. If the item has editable stats (such as relics), you can edit
it by changing the number in each cell after selecting the item.

You can change the name and optional description of a gear set by clicking 'Change Name/Description' at the top
of the editor area.

### Materia

You can manually equip materia by selecting an item, and then clicking the materia slots underneath the table for that
item slot.

#### Materia Solving

You can use the meld/food solver to solve the materia and food for your gearset. Enter the desired target GCD, and specify
if you would like it to overwrite existing food and materia.

You can lock materia slots (with control + click) to keep those unchanged or empty during a solve, though of course, that may not
guarantee that the best set is found.

#### Materia Fill

You can equip materia with ease by using the materia auto-fill controls in the toolbar. Drag the stats around to set 
your materia priority. You can also enter a minimum GCD - after getting your GCD down to this number, no further SpS/SkS
materia will be applied. Note that in order to hit this GCD, you would typically want SpS/SkS to be your
highest-priority stat.

You can then click the 'Fill Empty' button to auto-fill empty materia slots, or 'Fill All' to auto-fill all materia
slots, overwriting slots which are already full. You can also check the 'Fill When Selecting Items' to have slots
filled when selecting new items.

If materia melding would be irrelevant on an item due to ilvl sync settings, then you will not be able to meld that
item.

### Item Display Settings

The leftmost item on the toolbar is the item display controller. You can enter a minimum and maximum item level to
display for each item slot. If an item is already selected, it will be displayed even if it falls outside this range. 
Furthermore, the 'Weapon' table has a checkbox on top to display relics above the maximum allowed ilvl, as these are
often BiS even when synced down.

### Stat Tiering

The rightmost item on the toolbar shows stat tiering. Attributes in FFXIV work on discrete 'tiers' - roundoff error
within the game's damage formulae means that you may have to gain several of a stat before it actually increases your
damage or survivability. For each attribute, the '-' number is how far above the
next-lowest tier the stat currently is, and the '+' number is how far the stat is from the next-highest tier.
For example, if you see '-3 +7' for %CRT, then you could lose three critical hit points without actually losing any
critical hit chance, and you would need to gain seven points before it would increase your critical hit chance.
In other words, you are currently 'wasting' three points. In order to have no waste, you would need to either lose
three points (keeping your critical hit chance the same), or gain seven (increasing your critical hit chance).
If you are perfectly tiered, that is, you have no waste, then the '-' number will be replaced with a check mark.

## Simulations

Simulations are meant to estimate the damage of each set. When creating a new sheet, it will come with, at the very
least, the dmg/100p "Simulation". Some classes have more proper simulations. You can add more simulations by clicking
'Add Simulation' under the sets table. Some simulations have settings, so you can add multiple instances of the same
simulation, each with a different setup.

Each simulation is represented by a column in the sets table, showing how much DPS each sim does under that simulation.
Result numbers are tinted from green to red, to show the best to worst values respectively.

### Simulation Settings

If a simulation has settings, you can access the settings by clicking its column header. Faster simulations will
automatically re-run themselves after changing settings. Sims that might take a while to compute will instead have
a 'Re-run' button on their settings page.

You can also rename a simulation by entering its settings page, and then clicking the heading in the settings area.

Finally, you can delete a simulation by clicking the 'Delete' button on the settings page.

### Simulation Results

Some simulations produce detailed results on top of the DPS number, such as a list of abilities simulated and their
damage numbers. To access detailed results, click the cell corresponding to the simulation and set you wish to view.

## Exporting

You can export a whole sheet, or individual sets.

To export the sheet, click 'Export Whole Sheet' under the table. Then, pick which type of export you want, and click
'Generate' to generate your URL(s).

To export an individual set, select the set, then click 'Export This Set' underneath the set title in the editor area.
Note that if you wish to bulk export sets as individual set links, you can click 'Export Whole Sheet' but use the 
'One Link for Each Set' (or [Embed](#embeds) URL for Each Set) export style.

The checkboxes below will also allow you to choose which simulations you wish to export along with the sheet.

When you create an export link, it will be read-only. Other users will need to use the 'Save As' button if they wish
to make changes to it. You can still edit your copy of the sheet, and it will not affect the shared sheet.

### Embeds

There is a special export option called the 'Embed'. This is a smaller version of the normal view, which is intended
for embedding into space-constrained iframes. It is only usable for individual sets (or when using the
'One Link for Each Set', if you wish to do it in bulk). This view omits the sets table entirely.