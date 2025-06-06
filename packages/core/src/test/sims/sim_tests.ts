/* eslint-disable @typescript-eslint/no-explicit-any */
// REQUIRED - sets up fake HTML classes
import {describe, it} from "mocha";
import {assize, dia, exampleGearSet, filler, lily, misery, nop, pom} from "./common_values";
import * as assert from "assert";
import {Ability, SimResult, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings, MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {getRegisteredSimSpecs} from "@xivgear/core/sims/sim_registry";
import {BaseMultiCycleSim} from '@xivgear/core/sims/processors/sim_processors';
import {potRatioSimSpec} from '@xivgear/core/sims/common/potency_ratio';
import {registerDefaultSims} from '@xivgear/core/sims/default_sims';
import {getClassJobStats, JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {CharacterGearSet} from "../../gear";
import {GearPlanSheet, HEADLESS_SHEET_PROVIDER} from "../../sheet";
import {expect} from "chai";
import {EquipSlotInfo, EquipSlotKey} from "@xivgear/xivmath/geartypes";
import {FakeLocalStorage} from "../test_utils";

// Example of end-to-end simulation
// This one is testing the simulation engine itself, so it copies the full simulation code rather than
// referencing it. If you wish to test an actual simulation, you would want to reference it directly.

// Set up a simulation
export interface TestSimSettings extends SimSettings {
}

export interface TestSimSettingsExternal extends ExternalCycleSettings<TestSimSettings> {
}

// HEADLESS_SHEET_PROVIDER uses localStorage to save/load, so we still need this
// noinspection JSConstantReassignment
global.localStorage = new FakeLocalStorage();

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
    isDefaultSim: false,
};

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
            },

        }];
    }
}

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
            },
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
    isDefaultSim: false,
};
describe('Sim with custom cycle processor', () => {
    // Test the simulation
    it('can hook, and expose extra methods', async () => {
        // Initialize
        const inst: TestCustomMultiCycleSim = testCustomSimSpec.makeNewSimInstance();
        // Run simulation
        await inst.simulate(exampleGearSet);
        assert.equal(inst.fillerCount, 1);
    });
});

describe('Default sims', () => {
    describe('potency ratio sim', () => {
        it('Can instantiate, export, and load', () => {
            const simSpec = potRatioSimSpec;
            const inst: Simulation<any, any, any> = simSpec.makeNewSimInstance() as Simulation<any, any, any>;
            const exported = inst.exportSettings();
            simSpec.loadSavedSimInstance(exported);
        });
    });
    describe('all others', () => {
        registerDefaultSims();
        const registered = getRegisteredSimSpecs();
        const sampleSheets: GearPlanSheet[] = [];
        const sampleSheetLoad = new Map<GearPlanSheet, Promise<void>>();

        async function getSheetFor(job: JobName, level: SupportedLevel) {
            const existing = sampleSheets.find(set => set.classJobName === job && set.level === level);
            if (existing) {
                await sampleSheetLoad.get(existing);
                return existing;
            }
            else {
                const newSheet = HEADLESS_SHEET_PROVIDER.fromScratch(undefined, "", job, level, undefined, false);
                const promise = newSheet.load();
                sampleSheetLoad.set(newSheet, promise);
                sampleSheets.push(newSheet);
                await promise;
                return newSheet;
            }
        }

        for (const simSpec of registered) {
            describe(`sim '${simSpec.displayName}'`, () => {
                it('Can instantiate, export, and load', () => {
                    const inst: Simulation<any, any, any> = simSpec.makeNewSimInstance() as Simulation<any, any, any>;
                    const exported = inst.exportSettings();
                    simSpec.loadSavedSimInstance(exported);
                });
                it('Can run', async () => {
                    const inst: Simulation<SimResult, any, any> = simSpec.makeNewSimInstance() as Simulation<any, any, any>;
                    const job = simSpec.supportedJobs ? simSpec.supportedJobs[0] : 'WHM';
                    const level = simSpec.supportedLevels ? simSpec.supportedLevels[0] : (getClassJobStats(job).maxLevel ?? 100);
                    const sheet = await getSheetFor(job, level);
                    const set = new CharacterGearSet(sheet);
                    // Equip random gear in each slot
                    set.forEachSlot((slotKey: EquipSlotKey) => {
                        // Ignore offhand for classes which do not support it
                        if (slotKey === 'OffHand' && !sheet.classJobStats.offhand) {
                            return;
                        }
                        const gearSlot = EquipSlotInfo[slotKey].gearSlot;
                        const item = sheet.itemsForDisplay.find((item) => item.displayGearSlot === gearSlot);
                        expect(item).to.not.be.undefined;
                        expect(item).to.not.be.null;
                        set.setEquip(slotKey, item);
                    });
                    {
                        const results = await inst.simulate(set);
                        expect(results.mainDpsResult).to.be.greaterThan(0);
                    }
                    {
                        const exported = inst.exportSettings();
                        const newInst = simSpec.loadSavedSimInstance(exported);
                        const results = await newInst.simulate(set);
                        expect(results.mainDpsResult).to.be.greaterThan(0);
                    }
                }).timeout(30000);
            });
        }
    });
});
