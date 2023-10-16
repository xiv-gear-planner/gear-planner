import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {CustomTable, HeaderRow} from "../tables";
import {Ability, Buff, UsedAbility} from "./sim_types";
import {CycleProcessor} from "./sim_processors";
import {sum} from "../util/array_utils";
import {BuffSettingsArea, BuffSettingsExport, BuffSettingsManager} from "./party_comp_settings";


const filler: Ability = {
    name: "Filler",
    potency: 250,
    attackType: "Spell"
}

const combust: Ability = {
    name: "Combust",
    potency: 30 / 3 * 55,
    attackType: "Spell"
}

const star: Ability = {
    name: "Earthly Star",
    potency: 310,
    //fixedGcd: 0,
    attackType: "Ability"
}

const lord: Ability = {
    name: "Lord of Crowns",
    potency: 250,
    //fixedGcd: 0,
    attackType: "Ability"
}

const astrodyne: Buff = {
    name: "Astrodyne",
    job: "AST",
    selfOnly: true,
    duration: 15,
    cooldown: 0,
    effects: { //currently assumes 2 seal dynes, can change dmgIncrease based on frequency of 3 seals
        dmgIncrease: .00,
        haste: 10,
    }
}

class AstSimContext {
    constructor(private stats: ComputedSetStats, private allBuffs: Buff[]) {

    }

    getResult(): AstSheetSimResult {
        const cp = new CycleProcessor(120, [astrodyne, ...this.allBuffs], this.stats);
        cp.use(combust);
        cp.use(filler);
        cp.use(filler);
        cp.activateBuffs();
        cp.use(star);
        cp.use(filler);
        cp.use(lord); //with 50% lord, chance, assumes 1 lord per burst window
        cp.useUntil(filler, 30);
        cp.use(combust);
        cp.useUntil(filler, 60);
        cp.use(combust);
        cp.useUntil(filler, 67);
        cp.use(star);
        cp.useUntil(filler, 90);
        cp.use(combust);
        cp.useUntil(filler, 120);

        const used = cp.usedAbilities;
        const cycleDamage = sum(used.map(used => used.damage.expected));
        const dps = cycleDamage / cp.currentTime;
        const unbuffedPps = sum(used.map(used => used.ability.potency));

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
    displayName = "AST Sim";
    shortName = "ast-sheet-sim";

    constructor(settings?: AstNewSheetSettingsExternal) {
        if (settings) {
            Object.assign(this.settings, settings);
            this.buffManager = new BuffSettingsManager(settings.buffConfig);
        }
        else {
            this.buffManager = new BuffSettingsManager();
        }
    }

    // TODO
    makeConfigInterface(settings: AstNewSheetSettingsExternal, updateCallback: () => void): HTMLElement {
        const div = document.createElement("div");
        div.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        // const brdCheck = new FieldBoundCheckBox<AstSheetSettings>(settings, 'hasBard', {id: 'brd-checkbox'});
        // div.appendChild(labeledCheckbox('BRD in Party', brdCheck));
        // const schCheck = new FieldBoundCheckBox<AstSheetSettings>(settings, 'hasScholar', {id: 'sch-checkbox'});
        // div.appendChild(labeledCheckbox('SCH in Party', schCheck));
        // const drgCheck = new FieldBoundCheckBox<AstSheetSettings>(settings, 'hasDragoon', {id: 'drg-checkbox'});
        // div.appendChild(labeledCheckbox('DRG in Party', drgCheck));
        return div;
    }

    makeResultDisplay(result: AstSheetSimResult): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        mainResultsTable.classList.add('main-results-table');
        const abilitiesUsedTable = new CustomTable<UsedAbility>();
        abilitiesUsedTable.classList.add('abilities-used-table');
        abilitiesUsedTable.columns = [
            {
                shortName: 'time',
                displayName: 'Time',
                getter: used => used.usedAt,
                renderer: time => {
                    const minute = Math.floor(time / 60);
                    const second = time % 60;
                    return document.createTextNode(`${minute}:${second.toFixed(2).padStart(5, '0')}`);
                }
            },
            {
                shortName: 'ability',
                displayName: 'Ability',
                getter: used => used.ability.name
            },
            {
                shortName: 'unbuffed-pot',
                displayName: 'Pot',
                getter: used => used.ability.potency
            },
            {
                shortName: 'expected-damage',
                displayName: 'Damage',
                getter: used => used,
                renderer: used => {
                    let text = used.damage.expected.toFixed(2);
                    if ('portion' in used) {
                        text += '*';
                    }
                    return document.createTextNode(text);
                },
                colStyler: (value, colElement, internalElement) => {
                    if ('portion' in value) {
                        colElement.title = `This ability would not have fit completely within the allotted time.\nIt has been pro-rated to ${Math.floor(value.portion * 100)}% of the original damage.`
                    }
                },
            },
            {
                shortName: 'buffs',
                displayName: 'Buffs Active',
                getter: used => used.buffs,
                renderer: buffs => document.createTextNode(buffs.map(buff => buff.name).join(', ')),
            }
        ];
        abilitiesUsedTable.data = [new HeaderRow(), ...result.abilitiesUsed];
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