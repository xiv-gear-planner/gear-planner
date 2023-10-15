import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {Chain, Devilment, Litany, Mug} from "./buffs";
import {CustomTable, HeaderRow} from "../tables";
import {Ability, Buff, UsedAbility} from "./sim_types";
import {CycleProcessor} from "./sim_processors";
import {sum} from "../util/array_utils";


/**
 * Used for all 330p filler abilities
 */
const filler: Ability = {
    name: "Filler",
    potency: 330,
    attackType: "Spell"
}

const eDosis: Ability = {
    name: "E.Dosis",
    potency: 30 / 3 * 75,
    fixedGcd: 2.5,
    attackType: "Spell"
}

const phlegma: Ability = {
    name: "Phlegma",
    potency: 600,
    attackType: "Spell"
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
        const dps = cycleDamage / cp.currentTime;
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

export interface SgeSheetSettings extends SimSettings {
    hasBard: boolean,
    hasScholar: boolean,
    hasDragoon: boolean,
    rezPerMin: number,
    diagPerMin: number,
    progPerMin: number,
    eDiagPerMin: number,
    eProgPerMin: number,
    toxPerMin: number
}

export const sgeNewSheetSpec: SimSpec<SgeSheetSim, SgeSheetSettings> = {
    displayName: "SGE Sim Mk.II",
    loadSavedSimInstance(exported: SgeSheetSettings) {
        return new SgeSheetSim(exported);
    },
    makeNewSimInstance(): SgeSheetSim {
        return new SgeSheetSim();
    },
    stub: "sge-sheet-sim-mk2",
    supportedJobs: ['SGE'],
}

export class SgeSheetSim implements Simulation<SgeSheetSimResult, SgeSheetSettings, SgeSheetSettings> {

    exportSettings(): SgeSheetSettings {
        return {...this.settings};
    };

    settings: SgeSheetSettings = {
        hasBard: true,
        hasScholar: true,
        hasDragoon: true,
        rezPerMin: 0,
        diagPerMin: 0,
        progPerMin: 0,
        eDiagPerMin: 0,
        eProgPerMin: 0, // TODO: pick reasonable defaults
        toxPerMin: 0
    };

    spec = sgeNewSheetSpec;
    displayName = "SGE Sim Mk.II";
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeSheetSettings) {
        if (settings) {
            console.log("Loading sim settings", settings)
            Object.assign(this.settings, settings);
        }
    }

    // TODO
    makeConfigInterface(settings: SgeSheetSettings): HTMLElement {
        const div = document.createElement("div");
        div.textContent = 'Under construction';
        // const brdCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasBard', {id: 'brd-checkbox'});
        // div.appendChild(labeledCheckbox('BRD in Party', brdCheck));
        // const schCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasScholar', {id: 'sch-checkbox'});
        // div.appendChild(labeledCheckbox('SCH in Party', schCheck));
        // const drgCheck = new FieldBoundCheckBox<SgeSheetSettings>(settings, 'hasDragoon', {id: 'drg-checkbox'});
        // div.appendChild(labeledCheckbox('DRG in Party', drgCheck));
        return div;
    }

    makeResultDisplay(result: SgeSheetSimResult): HTMLElement {
        const mainResultsTable = simpleAutoResultTable({
            mainDpsResult: result.mainDpsResult,
            unbuffedPps: result.unbuffedPps
        });
        const abilitiesUsedTable = new CustomTable<UsedAbility>();
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
    makeToolTip(result: SgeSheetSimResult): string {
        return `DPS: ${result.mainDpsResult}\nUnbuffed PPS: ${result.unbuffedPps}\n`;
    }

    async simulate(set: CharacterGearSet): Promise<SgeSheetSimResult> {
        const ctx = new SgeSimContext(set.computedStats, [Mug, Litany, Chain, Devilment]);
        return ctx.getResult();
    }

}