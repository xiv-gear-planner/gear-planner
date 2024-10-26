# Contributing

This is my first major TS project from scratch, so it is entirely
possible that any existing code is crap. Feel free to clean it up,
though please ask before anything major.

## ESLint

This project uses ESLint to keep the style consistent and minimize avoidable
logic errors. It's recommended to set up an ESLint plugin for whatever IDE you're
using to write code. Before contributing a pull request, running ESLint locally
(e.g. via `npx -ws eslint ./src/**/*.ts --exit-on-fatal-error --max-warnings 0 --fix`, 
or on save via your IDE plugin) should result in no warnings.

## Visual Styles

Try to style things according to the included CSS to keep it visually
consistent.

Stats should be displayed only if potentially relevant (e.g. don't display
the wrong main stat for a class, and don't display irrelevant substats like
physical weapon damage on a healer, or tenacity on a DPS). Only display
stats that are relevant to what you are looking at (e.g. it doesn't make
sense to try to display a GCD number for an item).

In addition, when displaying choices, try to filter out obviously
useless choices, like piety materia on a DPS class.

Stats should be displayed as either the full name or the abbreviation
as appropriate. Both the full names and abbreviations are located in 
`xivconstants.ts` - use these rather than internal names, XivApi names,
or any other names.

Stats should be laid out in the following visual order:
1. GCD
2. Weapon Damage
3. Vitality
4. Main Stat (Str/Dex/Int/Mind)
5. Crit
6. Direct Hit
7. Determination
8. Spell/Skill Speed
9. Piety/Tenacity

## Adding Support for a New Job

To add a job, you must do the following:
1. Add the job to the `JobName` type in `xivconstants.ts`.
2. Add the job's level stats to `JOB_DATA` in `xivconstants.ts`.
3. If needed, add additional fields to `ComputedSetStats` and add the math to `get computedSetStats()` in `gear.ts`.

## Contributing Simulations

To add a simulation, you must do the following:
1. Write an implementation of `Simulation` which wires up the simulation logic.
2. Write an implementation of `SimSpec` which contains information about how to
create your `Simulation` instance.
3. Optional: Write an extension of `SimSettings` if your sim
has settings.
4. Add a line in simulation.ts to call `registerSim(simSpec)`
5. Add a GUI for your sim in `sim_guis.ts`. There are two default GUIs that can be
used, `BaseUsageCountSimGui` for count-based sims and `BaseMultiCycleSimGui` for cycle
sims. Optionally, you can write a custom UI in `packages/frontend/src/scripts/sims`, 
and register it instead. A custom UI can show sim-specific things like custom options, 
and gauge state throughout the rotation.

The main method for simulation logic is `async simulate(set: CharacterGearSet): Promise<SimResult> {}`.
Note that it is async - this is because it is expected that:
1. Sims can be run externally, e.g. via a REST API or WebWorkers.
2. Some sims will take noticeable time to run, and it is not appropriate to block the GUI during such time.

For most sims, e.g. easily-computed sim such as the built-in potency ratio sim,
or the existing sims utilizing `CycleProcessor`, it is fine for it to be implemented
directly into the sim class. If you have a Monte Carlo sim or anything else that
would require hard number crunching, then it should either expose an API that the
Gear Calc can connect to so that an external server can do the heavy lifting.
Or, if it is already written in TS/JS, it could be implemented via WebWorkers so that 
it will not block the UI.

To get started with implementing a `CycleProcessor` based sim, it may help to first look 
at the many examples within `packages/core/src/sims`. 

You can return additional fields in your `SimResults`. These extra fields will be exposed in a tooltip when
hovering over a cell.