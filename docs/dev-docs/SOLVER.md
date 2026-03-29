# Meld Solver

The meld/food solver uses WebWorkers to parallelize the work needed to brute-force optimize food and materia choices.

The worker entry point is worker_main.ts.

## Meld Solving Process

See `meldsolver.ts` for the general flow.

The process of solving melds is:

### Step 1: Ask User For Input

- Target a specific GCD?
- Overwrite existing (non-locked) melds?
- Try to solve for food as well?
- Which sim should be used for optimization?

### Step 2: Generate Unique Combinations of Melds

- Submit the task to the worker pool using the request type `GearsetGenerationRequest`
- The worker will periodically send messages back
- The message can either be `GearsetGenerationSetsUpdate` or `GearsetGenerationStatusUpdate`
    - A sets update contains a list of sets that have been generated. There is generally more than one of these, so that
      the list can be broken into smaller chunks. Each chunk should be identical in terms of rotation - but this does
      not work for classes with rotations that might depend on stats other than sps/sks/weapon delay.
    - A status update is exactly what it sounds like - it allows us to display a progress update to the user.

#### Internal Set Generation Logic

- For each gear slot:
    - If there is nothing in the slot, ignore it.
    - For each materia slot:
        - Ignore if the slot is locked
        - If the user chooses to overwrite existing materia, just empty out the materia slot before solving
        - For each stat relevant to the class:
            - Try to put the best possible materia in that slot
            - If it would overcap majorly, ignore it
            - Compute a key representing that combination of stats. If it would result in exactly the same stats as a
              different combination that we have already tested, ignore it (i.e. same materia but different order)

At this point, we have a map from the equip slot (e.g. left ring) to the list of all meld combinations that result in
unique resulting stats.
Now, we move on to generating combinations across all slots.

- For each (equipped) slot:
    - For each combination we found previously:
        - Compute the effective stats for that slot
        - Compute a stat uniqueness key, throw out anything non-unique
            - i.e. we want to throw out sets that have identical materia but shuffled around different items

At this point, we have all combinations of melds for all equipped slots that result in unique stats.
In addition,

Finally, if food solving is enabled, or no food was initially equipped, we create new combinations with each food item.
Also, we use the `MicroSetExport` isntead of a full set export to save memory, since this phase can take many GB
(and OOM crash the entire page, since the memory limit is shared between the main context and workers).

These are sent back as a map of GCD to list of combination.

### Step 3: Simulate Every Combination

In main context:

- Break the task into smaller chunks
    - Since these were sent back as a map of GCD to list of combinations, consecutive entries will usually be
      rotationally identical.
- Send the smaller chunks to the worker pool as a `SolverSimulationRequest`

In worker context, for each chunk:

- Run the simulation for each set. Due to the ordering, it can usually re-use the computed rotation and just re-do the
  damage math.
- Periodically send back status updates.
- Retain only the best result.

Back in the main context:

- Collect the results from each worker.
- Sort the results by DPS and choose the best set.
- Allow the user to choose whether to apply the new settings, or discard the results and keep their current gear.




