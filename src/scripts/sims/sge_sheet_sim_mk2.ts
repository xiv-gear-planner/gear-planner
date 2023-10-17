import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {CustomTable, HeaderRow} from "../tables";
import {GcdAbility, Buff, UsedAbility, Ability, OgcdAbility} from "./sim_types";
import {CycleProcessor} from "./sim_processors";
import {sum} from "../util/array_utils";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";
import {AbilitiesUsedTable} from "./components/ability_used_table";

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
}

const eDosis: GcdAbility = {
    type: 'gcd',
    name: "E.Dosis",
    potency: 30 / 3 * 75,
    attackType: "Spell",
    fixedGcd: true,
    gcd: 2.5,
    cast: 1.5,
}

const phlegma: GcdAbility = {
    type: 'gcd',
    name: "Phlegma",
    potency: 600,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
}

class SgeSimContext {
    constructor(private stats: ComputedSetStats, private allBuffs: Buff[]) {

    }

    getResult(): SgeSheetSimResult {
        const cp = new CycleProcessor(120, this.allBuffs, this.stats);
        cp.use(eDosis);
        cp.use(filler);
        cp.use(filler);
        cp.activateBuffs();
        cp.use(phlegma);
        cp.use(phlegma);
        cp.useUntil(filler, 30);
        cp.use(eDosis);
        cp.useUntil(filler, 60);
        cp.use(phlegma);
        cp.use(eDosis);
        cp.useUntil(filler, 90);
        cp.use(eDosis);
        cp.useUntil(filler, 120);

        const used = cp.usedAbilities;
        const cycleDamage = sum(used.map(used => used.damage.expected));
        const dps = cycleDamage / cp.nextGcdTime;
        const unbuffedPps = sum(used.map(used => used.ability.potency));

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

    spec = sgeNewSheetSpec;
    displayName = "SGE Sim Mk.II";
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeNewSheetSettingsExternal) {
        if (settings) {
            Object.assign(this.settings, settings);
            this.buffManager = new BuffSettingsManager(settings.buffConfig);
        }
        else {
            this.buffManager = new BuffSettingsManager();
        }
    }

    // TODO
    makeConfigInterface(settings: SgeNewSheetSettingsExternal, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
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
        const ctx = new SgeSimContext(set.computedStats, allBuffs);
        return ctx.getResult();
    }

}