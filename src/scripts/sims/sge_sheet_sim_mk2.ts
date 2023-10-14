import {simpleAutoResultTable, SimResult, SimSettings, SimSpec, Simulation} from "../simulation";
import {CharacterGearSet} from "../gear";
import {applyDhCrit, baseDamage} from "../xivmath";
import {AttackType, ComputedSetStats} from "../geartypes";

import {quickElement} from "../components/util";
import {Buff, BuffEffects, Chain, Devilment, Litany, Mug} from "./buffs";
import {CustomTable, HeaderRow} from "../tables";
import doc = Mocha.reporters.doc;

/**
 * Represents an ability you can use
 */
type Ability = {
    name: string,
    potency: number,
    attackType: AttackType,
    /**
     * If the ability's GCD can be lowered by sps/sks, put it here.
     */
    gcd?: number,
    /**
     * If the ability takes a fixed amount of time, rather than being reduced by sps/sks,
     * put it here.
     */
    fixedGcd?: number,
    autoCrit?: boolean,
    autoDh?: boolean
}

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

type ComputedDamage = {
    expected: number
}

/**
 * Represents an ability actually being used
 */
type UsedAbility = {
    ability: Ability,
    buffs: Buff[],
    usedAt: number,
    damage: ComputedDamage
}

/**
 * Represents a pseudo-ability used to round out a cycle to exactly 120s.
 *
 * e.g. If our last GCD of the 120s cycle would start at 118.9s, then we do not have enough time
 * remaining for an entire GCD. Thus, we would have a PartialAbility with portion = (1.1s / 2.5s)
 *
 */
type PartiallyUsedAbility = UsedAbility & {
    portion: number
}

function abilityToDamage(stats: ComputedSetStats, ability: Ability, buffs: Buff[], portion: number = 1): ComputedDamage {
    const basePot = ability.potency;
    const combinedEffects: BuffEffects = {
        dmgIncrease: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0
    }
    for (let buff of buffs) {
        if (buff.effects.dmgIncrease) {
            combinedEffects.dmgIncrease *= buff.effects.dmgIncrease;
        }
        if (buff.effects.critChanceIncrease) {
            combinedEffects.critChanceIncrease += buff.effects.critChanceIncrease;
        }
        if (buff.effects.dhitChanceIncrease) {
            combinedEffects.dhitChanceIncrease += buff.effects.dhitChanceIncrease;
        }
    }
    const modifiedStats = {...stats};
    modifiedStats.critChance += combinedEffects.critChanceIncrease;
    modifiedStats.dhitChance += combinedEffects.dhitChanceIncrease;
    const nonCritDmg = baseDamage(modifiedStats, basePot, ability.attackType, ability.autoDh ?? false, ability.autoCrit ?? false);
    const afterCritDh = applyDhCrit(nonCritDmg, modifiedStats);
    const afterDmgBuff = afterCritDh * combinedEffects.dmgIncrease;
    const afterPortion = afterDmgBuff * portion;
    return {
        expected: afterPortion
    }

}

class CycleProcessor {

    currentTime: number = 0;
    startOfBuffs: number | null = null;
    gcdBase: number;
    usedAbilities: (UsedAbility | PartiallyUsedAbility)[] = [];

    constructor(private cycleTime: number, private allBuffs: Buff[], private stats: ComputedSetStats) {
        this.gcdBase = this.stats.gcdMag(2.5);
    }

    /**
     * Get the buffs that would be active right now.
     */
    getActiveBuffs(): Buff[] {
        if (this.startOfBuffs === null) {
            return [];
        }
        return this.getBuffs(this.currentTime - this.startOfBuffs);
    }

    /**
     * Get the buffs that would be active `buffRemainingTime` since the start of the buff window.
     *
     * i.e. getBuffs(0) should return everything, getBuffs(15) would return 20 sec buffs but not 15, etc
     */
    getBuffs(buffRemainingTime: number): Buff[] {
        return this.allBuffs.filter(buff => buff.duration > buffRemainingTime);
    }

    /**
     * Start the raid buffs
     */
    activateBuffs() {
        this.startOfBuffs = this.currentTime;
    }

    /**
     * How many GCDs have been used
     */
    gcdCount() {
        return this.usedAbilities.length;
    }

    use(ability: Ability) {
        if (this.currentTime > this.cycleTime) {
            // Already over time. Ignore.
            return;
        }
        const abilityGcd = ability.fixedGcd ?? (ability.gcd ? this.stats.gcdMag(ability.gcd) : this.gcdBase);
        const gcdFinishedAt = this.currentTime + abilityGcd;
        const buffs = this.getActiveBuffs();
        if (gcdFinishedAt <= this.cycleTime) {
            // Enough time for entire GCD
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                usedAt: this.currentTime,
                damage: abilityToDamage(this.stats, ability, buffs),
            });
            this.currentTime = gcdFinishedAt;
        }
        else {
            const remainingTime = this.cycleTime - this.currentTime;
            const portion = remainingTime / abilityGcd;
            this.usedAbilities.push({
                ability: ability,
                buffs: buffs,
                usedAt: this.currentTime,
                portion: portion,
                damage: abilityToDamage(this.stats, ability, buffs, portion),
            });
            this.currentTime = this.cycleTime;
        }
    }

    useUntil(ability: Ability, useUntil: number) {
        while (this.currentTime < useUntil) {
            this.use(ability);
        }
    }
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

function sum(numbers: number[]) {
    return numbers.reduce((sum, val) => sum + val, 0);
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
    displayName: "SGE Sheet Sim Mk.II",
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
    displayName = "SGE Sheet Sim Mk.II";
    shortName = "sge-new-sheet-sim";

    constructor(settings?: SgeSheetSettings) {
        if (settings) {
            console.log("Loading sim settings", settings)
            Object.assign(this.settings, settings);
        }
    }

    makeConfigInterface(settings: SgeSheetSettings): HTMLElement {
        const div = document.createElement("div");
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