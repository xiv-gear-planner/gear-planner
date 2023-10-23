import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {GcdAbility, Buff, UsedAbility, OgcdAbility} from "./sim_types";
import {CycleProcessor} from "./sim_processors";
import {sum} from "../util/array_utils";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";
import {AbilitiesUsedTable} from "./components/ability_used_table";
import {Chain} from "./buffs";


const filler: GcdAbility = {
    type: 'gcd',
    name: "Broil",
    potency: 295,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
}

const chain: OgcdAbility = {
    type: 'ogcd',
    name: "Chain",
    activatesBuffs: [Chain],
    potency: null
}

const r2: GcdAbility = {
    type: 'gcd',
    name: "Ruin II",
    potency: 220,
    attackType: "Spell",
    gcd: 2.5,
}

const bio: GcdAbility = {
    type: 'gcd',
    name: "Biolysis",
    potency: 30 / 3 * 70,
    attackType: "Spell",
    gcd: 2.5,
}

const ed: OgcdAbility = {
    type: 'ogcd',
    name: "Energy Drain",
    potency: 100,
    attackType: "Ability"
}


class SchSimContext {
    constructor(private stats: ComputedSetStats, private allBuffs: Buff[]) {

    }

    getResult(): SchSheetSimResult {
        const cp = new CycleProcessor(120, this.allBuffs, this.stats, [Chain]);
        cp.useGcd(bio);
        cp.useGcd(filler);
        cp.useGcd(filler);
        cp.useOgcd(chain);
        cp.useGcd(filler);
        cp.useOgcd(ed);
        cp.useGcd(filler);
        cp.useOgcd(ed);
        cp.useGcd(filler);
        cp.useOgcd(ed);
        cp.useGcd(filler); //Aetherflow for MP and refreshing EDs
        cp.useGcd(filler);
        cp.useOgcd(ed);
        cp.useGcd(filler);
        cp.useOgcd(ed);
        cp.useGcd(filler);
        cp.useOgcd(ed);
        cp.useUntil(filler, 30);
        cp.useGcd(bio);
        cp.useUntil(filler, 60);
        cp.useGcd(bio);
        cp.useUntil(filler, 90);
        cp.useGcd(bio);
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

export interface SchSheetSimResult extends SimResult {
    abilitiesUsed: UsedAbility[],
    unbuffedPps: number
}

interface SchNewSheetSettings extends SimSettings {
    rezPerMin: number,
    gcdHealsPerMin: number,
    edPerMin: number,
    r2PerMin: number,
}

export interface SchNewSheetSettingsExternal extends SchNewSheetSettings {
    buffConfig: BuffSettingsExport;
}

export const schNewSheetSpec: SimSpec<SchSheetSim, SchNewSheetSettingsExternal> = {
    displayName: "SCH Sim",
    loadSavedSimInstance(exported: SchNewSheetSettingsExternal) {
        return new SchSheetSim(exported);
    },
    makeNewSimInstance(): SchSheetSim {
        return new SchSheetSim();
    },
    stub: "sch-sheet-sim",
    supportedJobs: ['SCH'],
}

export class SchSheetSim implements Simulation<SchSheetSimResult, SchNewSheetSettings, SchNewSheetSettingsExternal> {

    exportSettings(): SchNewSheetSettingsExternal {
        return {
            buffConfig: this.buffManager.exportSetting(),
            ...this.settings
        };
    };

    settings: SchNewSheetSettings = {
        rezPerMin: 0,
        gcdHealsPerMin: 0,
        edPerMin: 2,
        r2PerMin: 0,
    };
    readonly buffManager: BuffSettingsManager;

    spec = schNewSheetSpec;
    displayName = schNewSheetSpec.displayName;
    shortName = "sch-sheet-sim";

    constructor(settings?: SchNewSheetSettingsExternal) {
        if (settings) {
            Object.assign(this.settings, settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
        }
        else {
            this.buffManager = BuffSettingsManager.defaultForJob('SCH');
        }
    }

    // TODO
    makeConfigInterface(settings: SchNewSheetSettingsExternal, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return div;
    }

    makeResultDisplay(result: SchSheetSimResult): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new AbilitiesUsedTable(result.abilitiesUsed);
        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, abilitiesUsedTable]);
    }

    //
    makeToolTip(result: SchSheetSimResult): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    async simulate(set: CharacterGearSet): Promise<SchSheetSimResult> {
        const allBuffs = this.buffManager.enabledBuffs;
        const ctx = new SchSimContext(set.computedStats, allBuffs);
        return ctx.getResult();
    }

}
