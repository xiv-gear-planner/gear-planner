import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {CustomTable, HeaderRow} from "../tables";
import {GcdAbility, Buff, UsedAbility, OgcdAbility} from "./sim_types";
import {CycleProcessor} from "./sim_processors";
import {sum} from "../util/array_utils";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";
import {AbilitiesUsedTable} from "./components/ability_used_table";


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
    potency: (30 / 3 * 65) + 65,
    attackType: "Spell",
    gcd: 2.5,
}

const assize: OgcdAbility = {
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability"
}

const pom: Buff = {
    name: "Presence of Mind",
    job: "WHM",
    selfOnly: true,
    duration: 15,
    cooldown: 0,
    effects: { 
        haste: 20,
    }
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

class WhmSimContext {
    constructor(private stats: ComputedSetStats, private allBuffs: Buff[]) {

    }

    getResult(): WhmSheetSimResult {
        const cp = new CycleProcessor(120, [pom, ...this.allBuffs], this.stats);
        cp.use(dia);
        cp.use(filler);
        cp.use(filler);
        cp.activateBuffs();
        cp.use(filler);
        cp.use(assize);
        cp.use(misery);
        cp.useUntil(filler, 30);
        cp.use(dia);
        cp.use(lily); //3 lilys out of buffs to make up for misery in buffs, actual placement isn't specific
        cp.use(lily);
        cp.use(lily);
        cp.useUntil(filler, 50);
        cp.use(assize);
        cp.useUntil(filler, 60);
        cp.use(dia);
        cp.useUntil(filler, 70);
        cp.use(misery);
        cp.useUntil(filler, 90);
        cp.use(dia);
        cp.use(assize)
        cp.use(lily);
        cp.use(lily);
        cp.use(lily);
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

export interface WhmSheetSimResult extends SimResult {
    abilitiesUsed: UsedAbility[],
    unbuffedPps: number
}

interface WhmNewSheetSettings extends SimSettings {
    rezPerMin: number,
    med2PerMin: number,
    cure3PerMin: number,

}

export interface WhmNewSheetSettingsExternal extends WhmNewSheetSettings {
    buffConfig: BuffSettingsExport;
}

export const whmNewSheetSpec: SimSpec<WhmSheetSim, WhmNewSheetSettingsExternal> = {
    displayName: "WHM New Sim",
    loadSavedSimInstance(exported: WhmNewSheetSettingsExternal) {
        return new WhmSheetSim(exported);
    },
    makeNewSimInstance(): WhmSheetSim {
        return new WhmSheetSim();
    },
    stub: "whm-new-sheet-sim",
    supportedJobs: ['WHM'],
}

export class WhmSheetSim implements Simulation<WhmSheetSimResult, WhmNewSheetSettings, WhmNewSheetSettingsExternal> {

    exportSettings(): WhmNewSheetSettingsExternal {
        return {
            buffConfig: this.buffManager.exportSetting(),
            ...this.settings
        };
    };

    settings: WhmNewSheetSettings = {
        rezPerMin: 0,
        med2PerMin: 0,
        cure3PerMin: 0,
    };
    readonly buffManager: BuffSettingsManager;

    spec = whmNewSheetSpec;
    displayName = "WHM New Sim";
    shortName = "whm-new-sheet-sim";

    constructor(settings?: WhmNewSheetSettingsExternal) {
        if (settings) {
            Object.assign(this.settings, settings);
            this.buffManager = new BuffSettingsManager(settings.buffConfig);
        }
        else {
            this.buffManager = new BuffSettingsManager();
        }
    }

    // TODO
    makeConfigInterface(settings: WhmNewSheetSettingsExternal, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return div;
    }

    makeResultDisplay(result: WhmSheetSimResult): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new AbilitiesUsedTable(result.abilitiesUsed);
        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, abilitiesUsedTable]);
    }

    //
    makeToolTip(result: WhmSheetSimResult): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    async simulate(set: CharacterGearSet): Promise<WhmSheetSimResult> {
        const allBuffs = this.buffManager.enabledBuffs;
        const ctx = new WhmSimContext(set.computedStats, allBuffs);
        return ctx.getResult();
    }

}
