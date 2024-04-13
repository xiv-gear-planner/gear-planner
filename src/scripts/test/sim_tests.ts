// REQUIRED - sets up fake HTML classes
import 'global-jsdom/register'
import {it} from "mocha";
import {SimSettings, SimSpec} from "../simulation";
import {Buff, FinalizedAbility, GcdAbility, OgcdAbility} from "../sims/sim_types";
import {CharacterGearSet} from "../gear";
import {JobMultipliers} from "../geartypes";
import {finalizeStats} from "../xivstats";
import {getClassJobStats, getLevelStats} from "../xivconstants";

import {
    BaseMultiCycleSim,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    Rotation
} from "../sims/sim_processors";
import {assertClose, isClose, makeFakeSet} from "./test_utils";
import * as assert from "assert";
import {Divination, Litany, Mug} from "../sims/buffs";
import {sgeNewSheetSpec} from "../sims/sge_sheet_sim_mk2";
import {assertSimAbilityResults, setPartyBuffEnabled, UseResult} from "./sim_test_utils";

// Example of end-to-end simulation
// This one is testing the simulation engine itself, so it copies the full simulation code rather than
// referencing it. If you wish to test an actual simulation, you would want to reference it directly.

// Set up a simulation
interface TestSimSettings extends SimSettings {
}

export interface TestSimSettingsExternal extends ExternalCycleSettings<TestSimSettings> {
}

const filler: GcdAbility = {
    type: 'gcd',
    name: "Glare",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
}

const nop: GcdAbility = {
    type: 'gcd',
    name: "NOP",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 2.0
}

const dia: GcdAbility = {
    type: 'gcd',
    name: "Dia",
    potency: 65,
    dot: {
        id: 1871,
        tickPotency: 65,
        duration: 30
    },
    attackType: "Spell",
    gcd: 2.5,
}

const assize: OgcdAbility = {
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability"
}

const pom: OgcdAbility = {
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [
        {
            name: "Presence of Mind",
            job: "WHM",
            selfOnly: true,
            duration: 15,
            cooldown: 120,
            effects: {
                haste: 20,
            },
        }
    ],
    attackType: "Ability"
}

const misery: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1240,
    attackType: "Spell",
    gcd: 2.5,
}

const lily: GcdAbility = {
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
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

// Replace data that would normally be loaded from xivapi with fixed data
const jobStatMultipliers: JobMultipliers = {
    dexterity: 105,
    hp: 105,
    intelligence: 105,
    mind: 115,
    strength: 55,
    vitality: 100
};
// Stats from a set. These should be the stats WITH items and race bonus, but WITHOUT party bonus
const rawStats = {
    // From https://share.xivgear.app/share/74fb005d-086f-45d3-bee8-9a211559f7df
    crit: 2287,
    determination: 1806,
    dexterity: 409,
    dhit: 400,
    hp: 0,
    intelligence: 409,
    mind: 3376,
    piety: 535,
    skillspeed: 400,
    spellspeed: 1522,
    strength: 214,
    tenacity: 400,
    vitality: 3321,
    wdMag: 132,
    wdPhys: 132,
    weaponDelay: 3.44
};
// Finalize the stats (add class modifiers, party bonus, etc)
const stats = finalizeStats(rawStats, 90, getLevelStats(90), 'WHM', {
    ...getClassJobStats('WHM'),
    jobStatMultipliers: jobStatMultipliers
}, 5);

// Turn the stats into a fake gear set. This object does not implement all of the methods that a CharacterGearSet
// should, only the ones that would commonly be used in a simulation.
const set: CharacterGearSet = makeFakeSet(stats);

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
        damage: 39.04
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
        damage: 40.99
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
        damage: 45.72
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
        damage: 45.72
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
        damage: 45.72
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
        damage: 39.04
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
describe('cycle sim processor tests', () => {
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
        let result = await inst.simulate(set);
        // Assert correct results
        assertClose(result.mainDpsResult, 9898.56, 0.01);
        assertSimAbilityResults(result, expectedAbilities);
    });
});