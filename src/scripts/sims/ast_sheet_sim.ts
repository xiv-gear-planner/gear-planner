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
    name: "Malefic",
    potency: 250,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
}

const combust: GcdAbility = {
    type: 'gcd',
    name: "Combust",
    potency: 30 / 3 * 55,
    attackType: "Spell",
    gcd: 2.5,
}

const star: OgcdAbility = {
    type: 'ogcd',
    name: "Earthly Star",
    potency: 310,
    attackType: "Ability"
}

const lord: OgcdAbility = {
    type: 'ogcd',
    name: "Lord of Crowns",
    potency: 250,
    attackType: "Ability"
}

const astrodyne: OgcdAbility = {
    name: "Astrodyne",
    type: "ogcd",
    potency: null,
    activatesBuffs: [
        {
            name: "Astrodyne",
            job: "AST",
            selfOnly: true,
            duration: 15,
            cooldown: 0,
            effects: { //currently assumes 2 seal dynes, can change dmgIncrease based on frequency of 3 seals
                // dmgIncrease: 0.00,
                haste: 10,
            },
            startTime: null,
        }
    ]
}

class AstSimContext {
    constructor(private stats: ComputedSetStats, private allBuffs: Buff[]) {

    }

    getResult(): AstSheetSimResult {
        const cp = new CycleProcessor(120, this.allBuffs, this.stats);
        cp.use(combust); //play, draw
        cp.use(filler); //play, draw
        cp.use(filler); //div, play
        cp.use(filler); //MA, dyne
        cp.useOgcd(astrodyne);
        cp.use(filler);
        cp.use(star);
        cp.use(filler);
        cp.use(lord); //with 50% lord, chance, assumes 1 lord per burst window
        cp.useUntil(filler, 30);
        cp.use(combust);
        cp.useUntil(filler, 60);
        cp.use(combust);
        cp.useUntil(filler, 75);
        cp.use(star);
        cp.useUntil(filler, 90);
        cp.use(combust);
        cp.useUntil(filler, 120);

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

export interface AstSheetSimResult extends SimResult {
    abilitiesUsed: UsedAbility[],
    unbuffedPps: number
}

interface AstNewSheetSettings extends SimSettings {
    rezPerMin: number,
    aspHelPerMin: number,
    aspBenPerMin: number,

}

export interface AstNewSheetSettingsExternal extends AstNewSheetSettings {
    buffConfig: BuffSettingsExport;
}

export const astNewSheetSpec: SimSpec<AstSheetSim, AstNewSheetSettingsExternal> = {
    displayName: "AST Sim",
    loadSavedSimInstance(exported: AstNewSheetSettingsExternal) {
        return new AstSheetSim(exported);
    },
    makeNewSimInstance(): AstSheetSim {
        return new AstSheetSim();
    },
    stub: "ast-sheet-sim",
    supportedJobs: ['AST'],
}

export class AstSheetSim implements Simulation<AstSheetSimResult, AstNewSheetSettings, AstNewSheetSettingsExternal> {

    exportSettings(): AstNewSheetSettingsExternal {
        return {
            buffConfig: this.buffManager.exportSetting(),
            ...this.settings
        };
    };

    settings: AstNewSheetSettings = {
        rezPerMin: 0,
        aspHelPerMin: 0,
        aspBenPerMin: 0,
    };
    readonly buffManager: BuffSettingsManager;

    spec = astNewSheetSpec;
    displayName = astNewSheetSpec.displayName;
    shortName = "ast-sheet-sim";

    constructor(settings?: AstNewSheetSettingsExternal) {
        if (settings) {
            Object.assign(this.settings, settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
        }
        else {
            this.buffManager = BuffSettingsManager.defaultForJob('AST');
        }
    }

    // TODO
    makeConfigInterface(settings: AstNewSheetSettingsExternal, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return div;
    }

    makeResultDisplay(result: AstSheetSimResult): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new AbilitiesUsedTable(result.abilitiesUsed);
        return quickElement('div', ['cycle-sim-results-table'], [mainResultsTable, abilitiesUsedTable]);
    }

    //
    makeToolTip(result: AstSheetSimResult): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    async simulate(set: CharacterGearSet): Promise<AstSheetSimResult> {
        const allBuffs = this.buffManager.enabledBuffs;
        const ctx = new AstSimContext(set.computedStats, allBuffs);
        return ctx.getResult();
    }

}
