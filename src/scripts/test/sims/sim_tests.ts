// REQUIRED - sets up fake HTML classes
import 'global-jsdom/register'
import {it} from "mocha";
import {SimSettings, SimSpec} from "../../simulation";

import {
    AbilityUseResult,
    BaseMultiCycleSim,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "../../sims/sim_processors";
import {assertClose} from "../test_utils";
import {Divination, Litany, Mug} from "../../sims/buffs";
import {assertSimAbilityResults, setPartyBuffEnabled, UseResult} from "./sim_test_utils";
import {assize, dia, exampleGearSet, filler, lily, misery, nop, pom} from "./common_values";
import {Ability} from "../../sims/sim_types";
import * as assert from "assert";

// Example of end-to-end simulation
// This one is testing the simulation engine itself, so it copies the full simulation code rather than
// referencing it. If you wish to test an actual simulation, you would want to reference it directly.

// Set up a simulation
interface TestSimSettings extends SimSettings {
}

export interface TestSimSettingsExternal extends ExternalCycleSettings<TestSimSettings> {
}


export const testSimSpec: SimSpec<TestMultiCycleSim, TestSimSettingsExternal> = {
    displayName: "Test WHM Sim",
    loadSavedSimInstance(exported: TestSimSettingsExternal) {
        return new TestMultiCycleSim(exported);
    },
    makeNewSimInstance(): TestMultiCycleSim {
        return new TestMultiCycleSim();
    },
    stub: "test-whm-sim",
    supportedJobs: ['WHM'],
    isDefaultSim: false
}

export interface TestSimResult extends CycleSimResult {
}

class TestMultiCycleSim extends BaseMultiCycleSim<TestSimResult, TestSimSettings> {
    spec = testSimSpec;
    displayName = testSimSpec.displayName;
    shortName = "WHM-new-sheet-sim";

    constructor(settings?: TestSimSettingsExternal) {
        super('WHM', settings);
    }

    makeDefaultSettings(): TestSimSettings {
        return {};
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                // These should NOT start combat because their damage === null
                cp.use(nop);
                cp.use(nop);
                cp.use(nop);
                cp.use(filler);
                cp.remainingCycles(cycle => {
                    cycle.use(dia);
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.useOgcd(pom);
                    cycle.use(filler);
                    cycle.use(assize);
                    if (cycle.cycleNumber > 0) {
                        cycle.use(misery);
                    }
                    cycle.useUntil(filler, 30);
                    cycle.use(dia);
                    cycle.use(lily); //3 lilys out of buffs to make up for misery in buffs, actual placement isn't specific
                    cycle.use(lily);
                    cycle.use(lily);
                    cycle.useUntil(filler, 50);
                    cycle.use(assize);
                    cycle.useUntil(filler, 60);
                    cycle.use(dia);
                    cycle.useUntil(filler, 70);
                    cycle.use(misery);
                    cycle.useUntil(filler, 90);
                    cycle.use(dia);
                    cycle.use(assize);
                    if (cycle.cycleNumber > 1) {
                        cycle.use(lily);
                        cycle.use(lily);
                        cycle.use(lily);
                    }
                    cycle.useUntil(filler, 'end');
                });
            }

        }];
    }
}


// Expected sim outcome
const expectedAbilities: UseResult[] = [
    {
        time: -8.41,
        name: 'NOP',
        damage: 0
    },
    {
        time: -6.10,
        name: 'NOP',
        damage: 0
    },
    {
        time: -3.79,
        name: 'NOP',
        damage: 0
    },
    {
        time: -1.48,
        name: 'Glare',
        damage: 15078.38
    },
    {
        time: 0,
        name: 'Auto Attack',
        damage: 33.30
    },
    {
        time: 0.83,
        name: 'Dia',
        damage: 37174.05
    },
    {
        time: 3.14,
        name: 'Glare',
        damage: 15832.30
    },
    {
        time: 4.32,
        name: 'Auto Attack',
        damage: 34.97
    },
    {
        time: 5.45,
        name: 'Glare',
        damage: 15832.30
    },
    {
        time: 6.93,
        name: 'Presence of Mind',
        damage: 0
    },
    {
        time: 7.76,
        name: 'Glare',
        damage: 17656.20
    },
    {
        time: 8.96,
        name: "Assize",
        damage: 22783.24
    },
    {
        time: 9.24,
        name: "Auto Attack",
        damage: 38.99
    },
    {
        time: 9.60,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 11.44,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 13.28,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 14.48,
        name: "Auto Attack",
        damage: 38.99
    },
    {
        time: 15.12,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 16.96,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 18.80,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 19.72,
        name: "Auto Attack",
        damage: 38.99
    },
    {
        time: 20.64,
        name: "Glare",
        damage: 17656.2
    },
    {
        time: 22.48,
        name: "Glare",
        damage: 15832.3
    },
    {
        time: 24.32,
        name: "Glare",
        damage: 15078.38
    },
    {
        time: 25.24,
        name: "Auto Attack",
        damage: 33.30
    },
    {
        time: 26.63,
        name: "Glare",
        damage: 15078.38
    },
    {
        time: 28.94,
        name: "Glare",
        damage: 6919.08
    },
]


// The test
describe('Cycle sim processor', () => {
    // Test the simulation
    it('produces the correct results', async () => {
        // Initialize
        const inst: TestMultiCycleSim = testSimSpec.makeNewSimInstance();
        inst.cycleSettings.totalTime = 30;
        // Enable buffs
        setPartyBuffEnabled(inst, Mug, true);
        setPartyBuffEnabled(inst, Litany, true);
        setPartyBuffEnabled(inst, Divination, true);
        // Run simulation
        let result = await inst.simulate(exampleGearSet);
        // Assert correct results
        assertClose(result.mainDpsResult, 9897.32, 0.01);
        assertSimAbilityResults(result, expectedAbilities);
    });
});

class CustomCycleProcessor extends CycleProcessor {
    private fillerCount: number = 0;

    use(ability: Ability): AbilityUseResult {
        const out = super.use(ability);
        if (ability === filler) {
            this.fillerCount++;
        }
        return out;
    }

    get count() {
        return this.fillerCount;
    }
}

class TestCustomMultiCycleSim extends BaseMultiCycleSim<TestSimResult, TestSimSettings, CustomCycleProcessor> {
    spec = testSimSpec;
    displayName = testSimSpec.displayName;
    shortName = "WHM-new-sheet-sim";
    fillerCount: number;

    constructor(settings?: TestSimSettingsExternal) {
        super('WHM', settings);
    }

    makeDefaultSettings(): TestSimSettings {
        return {};
    }

    protected createCycleProcessor(settings: MultiCycleSettings): CustomCycleProcessor {
        return new CustomCycleProcessor(settings);
    }

    getRotationsToSimulate(): Rotation<CustomCycleProcessor>[] {
        const outer = this;
        return [{
            cycleTime: 120,
            apply(cp: CustomCycleProcessor) {
                cp.use(filler);
                cp.use(dia);
                cp.use(nop);
                outer.fillerCount = cp.count;
            }
        }];
    }
}

export const testCustomSimSpec: SimSpec<TestCustomMultiCycleSim, TestSimSettingsExternal> = {
    displayName: "Test Custom Sim",
    loadSavedSimInstance(exported: TestSimSettingsExternal) {
        return new TestCustomMultiCycleSim(exported);
    },
    makeNewSimInstance(): TestCustomMultiCycleSim {
        return new TestCustomMultiCycleSim();
    },
    stub: "test-custom-sim",
    supportedJobs: ['WHM'],
    isDefaultSim: false
}
describe('Sim with custom cycle processor', () => {
    // Test the simulation
    it('can hook, and expose extra methods', async () => {
        // Initialize
        const inst: TestCustomMultiCycleSim = testCustomSimSpec.makeNewSimInstance();
        // Run simulation
        let result = await inst.simulate(exampleGearSet);
        assert.equal(inst.fillerCount, 1);
    });
});
