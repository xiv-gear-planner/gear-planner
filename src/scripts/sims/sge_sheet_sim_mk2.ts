import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {Buff, GcdAbility, UsedAbility} from "./sim_types";
import {MultiCycleProcessor} from "./sim_processors";
import {sum} from "../util/array_utils";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";
import {AbilitiesUsedTable} from "./components/ability_used_table";
import {CycleSettings, defaultCycleSettings} from "./cycle_settings";
import {cycleSettingsGui} from "../components/cycle_settings_components";
import {writeProxy} from "../util/proxies";

/**
 * Used for all 330p filler abilities
 */
const filler: GcdAbility = {
    type: 'gcd',
    name: "Filler",
    potency: 330,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24312
}

const eDosis: GcdAbility = {
    type: 'gcd',
    name: "E.Dosis",
    potency: 30 / 3 * 75,
    attackType: "Spell",
    fixedGcd: true,
    gcd: 2.5,
    cast: 1.5,
    id: 24314,
}

const phlegma: GcdAbility = {
    type: 'gcd',
    name: "Phlegma",
    potency: 600,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24313
}

class SgeSimContext {
    constructor(private stats: ComputedSetStats, private allBuffs: Buff[], private cycleSettings: CycleSettings) {

    }

    getResult(): SgeSheetSimResult {
        const cp = new MultiCycleProcessor({
            stats: this.stats,
            totalTime: this.cycleSettings.totalTime,
            cycleTime: 120,
            allBuffs: this.allBuffs,
            manuallyActivatedBuffs: []
        });
        // cp.prePull(cycle => {
        //     cycle.useGcd(filler);
        // });
        cp.remainingCycles(cycle => {
            // Do a pre-pull filler GCD if we're on the first cycle
            if (cycle.cycleNumber === 0) {
                cycle.useGcd(filler);
            }
            cycle.use(eDosis);
            cycle.use(filler);
            cycle.use(filler);
            cycle.use(phlegma);
            cycle.use(phlegma);
            cycle.useUntil(filler, 30);
            cycle.use(eDosis);
            cycle.useUntil(filler, 60);
            cycle.use(eDosis);
            cycle.use(phlegma);
            cycle.useUntil(filler, 90);
            cycle.use(eDosis);
            cycle.useUntil(filler, 120);
        });


        const used = cp.usedAbilities;
        const cycleDamage = sum(used.map(used => used.damage.expected));
        const dps = cycleDamage / cp.nextGcdTime;
        const unbuffedPps = sum(used.map(used => used.ability.potency)) / cp.nextGcdTime;

        return {
            mainDpsResult: dps,
            abilitiesUsed: [...used],
            unbuffedPps: unbuffedPps
        }
    }
}

export interface SgeSheetSimResult extends SimResult {
    abilitiesUsed: UsedAbility[],
    unbuffedPps: number
}

interface SgeNewSheetSettings extends SimSettings {
    rezPerMin: number,
    diagPerMin: number,
    progPerMin: number,
    eDiagPerMin: number,
    eProgPerMin: number,
    toxPerMin: number

}

export interface SgeNewSheetSettingsExternal extends SgeNewSheetSettings {
    buffConfig: BuffSettingsExport;
    cycleSettings: CycleSettings;
}

export const sgeNewSheetSpec: SimSpec<SgeSheetSim, SgeNewSheetSettingsExternal> = {
    displayName: "SGE Sim Mk.II",
    loadSavedSimInstance(exported: SgeNewSheetSettingsExternal) {
        return new SgeSheetSim(exported);
    },
    makeNewSimInstance(): SgeSheetSim {
        return new SgeSheetSim();
    },
    stub: "sge-sheet-sim-mk2",
    supportedJobs: ['SGE'],
}

export class SgeSheetSim implements Simulation<SgeSheetSimResult, SgeNewSheetSettings, SgeNewSheetSettingsExternal> {

    exportSettings(): SgeNewSheetSettingsExternal {
        return {
            ...this.settings,
            buffConfig: this.buffManager.exportSetting(),
            cycleSettings: this.cycleSettings
        };
    };

    settings: SgeNewSheetSettings = {
        rezPerMin: 0,
        diagPerMin: 0,
        progPerMin: 0,
        eDiagPerMin: 0,
        eProgPerMin: 0, // TODO: pick reasonable defaults
        toxPerMin: 0
    };
    readonly buffManager: BuffSettingsManager;
    readonly cycleSettings: CycleSettings;

    spec = sgeNewSheetSpec;
    displayName = sgeNewSheetSpec.displayName;
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeNewSheetSettingsExternal) {
        if (settings) {
            Object.assign(this.settings, settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
            this.cycleSettings = settings.cycleSettings ?? defaultCycleSettings();
        }
        else {
            this.buffManager = BuffSettingsManager.defaultForJob('SGE');
            this.cycleSettings = defaultCycleSettings();
        }
    }

    // TODO
    makeConfigInterface(settings: SgeNewSheetSettingsExternal, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
        div.appendChild(cycleSettingsGui(writeProxy(this.cycleSettings, updateCallback)));
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return div;
    }

    makeResultDisplay(result: SgeSheetSimResult): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new AbilitiesUsedTable(result.abilitiesUsed);
        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, abilitiesUsedTable]);
    }

    //
    makeToolTip(result: SgeSheetSimResult): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    async simulate(set: CharacterGearSet): Promise<SgeSheetSimResult> {
        const allBuffs = this.buffManager.enabledBuffs;
        const ctx = new SgeSimContext(set.computedStats, allBuffs, this.cycleSettings);
        return ctx.getResult();
    }

}
