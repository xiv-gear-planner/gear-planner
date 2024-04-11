// REQUIRED - sets up fake HTML classes
import 'global-jsdom/register'
import {it} from "mocha";
import {SimSettings, SimSpec} from "../simulation";
import {GcdAbility, OgcdAbility} from "../sims/sim_types";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats, EquipmentSet, GearItem, JobMultipliers} from "../geartypes";
import {finalizeStats} from "../xivstats";
import {getClassJobStats, getLevelStats} from "../xivconstants";

import {
    BaseMultiCycleSim,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    Rotation
} from "../sims/sim_processors";
import {assertClose, makeFakeSet} from "./test_utils";
import * as assert from "assert";

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

describe('cycle sim processor tests', () => {
    // Test the simulation
    it('produces the correct results', async () => {
        const inst: TestMultiCycleSim = testSimSpec.makeNewSimInstance();
        const jobStatMultipliers: JobMultipliers = {
            dexterity: 105,
            hp: 105,
            intelligence: 105,
            mind: 115,
            strength: 55,
            vitality: 100
        };
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
        const stats = finalizeStats(rawStats, 90, getLevelStats(90), 'WHM', {
            ...getClassJobStats('WHM'),
            jobStatMultipliers: jobStatMultipliers
        }, 5);
        const set: CharacterGearSet = makeFakeSet(stats);
        let result = await inst.simulate(set);
        assertClose(result.mainDpsResult, 8065.90, 0.01);
        const used = result.abilitiesUsed;
        assert.equal(used[0].usedAt, -1.48);
        assert.equal(used[0].ability.name, 'Glare');
        assertClose(used[0].directDamage.expected, 15078.38, 0.01);
    });
});