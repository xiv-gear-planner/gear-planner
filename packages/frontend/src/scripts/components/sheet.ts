/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: get back to fixing this at some point
import {camel2title, capitalizeFirstLetter, toRelPct} from "@xivgear/core/util/strutils";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelect,
    SingleSelectionModel
} from "../tables";
import {GearPlanSheet, SheetProvider} from "@xivgear/core/sheet";
import {
    faIcon,
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundTextField,
    labeledCheckbox,
    makeActionButton,
    quickElement
} from "@xivgear/common-ui/components/util";
import {closeModal} from "@xivgear/common-ui/modalcontrol";
import {
    ChanceStat,
    ComputedSetStats,
    DisplayGearSlot,
    EquipSlotKey,
    EquipSlots,
    GearItem,
    MateriaAutoFillController,
    MateriaAutoFillPrio, MateriaFillMode,
    MultiplierMitStat,
    MultiplierStat,
    PartyBonusAmount,
    RawStatKey,
    SetExport,
    SheetExport
} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet} from "@xivgear/core/gear";
import {
    getClassJobStats,
    JobName,
    MAX_PARTY_BONUS,
    RACE_STATS,
    RaceName,
    STAT_ABBREVIATIONS
} from "@xivgear/xivmath/xivconstants";
import {getCurrentHash} from "../nav_hash";
import {MateriaTotalsDisplay} from "./materia";
import {FoodItemsTable, FoodItemViewTable, GearItemsTable, GearItemsViewTable} from "./items";
import {SetViewToolbar} from "./totals_display";
import {scrollIntoView} from "@xivgear/common-ui/util/scrollutil";
import {installDragHelper} from "./draghelpers";
import {iconForIssues, SetIssuesModal} from "./gear_set_issues";
import {Inactivitytimer} from "@xivgear/core/util/inactivitytimer";
import {startExport} from "./export_controller";
import {startRenameSet, startRenameSheet} from "./rename_dialog";
import {writeProxy} from "@xivgear/core/util/proxies";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {GearEditToolbar} from "./gear_edit_toolbar";
import {SETTINGS} from "../settings/persistent_settings";
import {openSheetByKey, setTitle} from "../base_ui";
import {parseImport} from "@xivgear/core/imports/imports";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {getSetFromEtro} from "@xivgear/core/external/etro_import";
import {getBisSheet} from "@xivgear/core/external/static_bis";
import {simpleAutoResultTable} from "../sims/components/simple_tables";
import {rangeInc} from "@xivgear/core/util/array_utils";
import {SimCurrentResult, SimResult, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {getRegisteredSimSpecs} from "@xivgear/core/sims/sim_registry";
import {makeUrl} from "@xivgear/core/nav/common_nav";
import {simMaintainersInfoElement} from "./sims";
import {SaveAsModal} from "./new_sheet_form";
import {DropdownActionMenu} from "./dropdown_actions_menu";
import {CustomFoodPopup, CustomItemPopup} from "./custom_item_manager";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";

export type GearSetSel = SingleCellRowOrHeaderSelect<CharacterGearSet>;

const noSeparators = (set: CharacterGearSet) => !set.isSeparator;

const isSafari: boolean = (() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('safari') && !ua.includes('chrome');
})();

function mainStatCol(sheet: GearPlanSheet, stat: RawStatKey): CustomColumnSpec<CharacterGearSet, MultiplierStat> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: gearSet => ({
            stat: gearSet.computedStats[stat],
            multiplier: gearSet.computedStats.mainStatMulti
        }),
        condition: () => sheet.isStatRelevant(stat),
        renderer: multiplierStatTooltip,
        extraClasses: ['stat-col', 'main-stat-col'],
        rowCondition: noSeparators,
    }
}

function tooltipMultiStatCol(sheet: GearPlanSheet, stat: RawStatKey, multiKey: { [K in keyof ComputedSetStats]: ComputedSetStats[K] extends number ? K : never }[keyof ComputedSetStats]): CustomColumnSpec<CharacterGearSet, MultiplierStat> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: gearSet => ({
            stat: gearSet.computedStats[stat],
            multiplier: gearSet.computedStats[multiKey]
        }),
        condition: () => sheet.isStatRelevant(stat),
        renderer: multiplierStatTooltip,
        extraClasses: ['stat-col', 'compact-multiplier-stat-col'],
        rowCondition: noSeparators,
    }
}

function multiplierStatTooltip(stats: MultiplierStat) {
    return textWithToolTip(stats.stat.toString(), 'Multiplier: x' + stats.multiplier.toFixed(3));
}

function multiplierStatDisplay(stats: MultiplierStat) {
    const outerDiv = document.createElement("div");
    outerDiv.classList.add('multiplier-stat-display');
    const leftSpan = document.createElement("span");
    leftSpan.textContent = stats.stat.toString();
    outerDiv.appendChild(leftSpan);
    const rightSpan = document.createElement("span");
    rightSpan.textContent = (`(x${stats.multiplier.toFixed(3)})`);
    rightSpan.classList.add("extra-stat-info");
    outerDiv.appendChild(rightSpan);
    return outerDiv;
}

function chanceStatDisplay(stats: ChanceStat) {
    const outerDiv = document.createElement("div");
    outerDiv.classList.add('chance-stat-display');
    const leftSpan = document.createElement("span");
    leftSpan.textContent = stats.stat.toString();
    outerDiv.appendChild(leftSpan);
    const rightSpan = document.createElement("span");
    rightSpan.textContent = (`(${(stats.chance * 100.0).toFixed(1)}%x${stats.multiplier.toFixed(3)})`);
    rightSpan.classList.add("extra-stat-info");
    outerDiv.appendChild(rightSpan);
    return outerDiv;
}

function multiplierMitStatDisplay(stats: MultiplierMitStat) {
    const outerDiv = document.createElement("div");
    outerDiv.classList.add('multiplier-mit-stat-display');
    const leftSpan = document.createElement("span");
    leftSpan.textContent = stats.stat.toString();
    outerDiv.appendChild(leftSpan);
    const rightSpan = document.createElement("span");
    rightSpan.textContent = (`(x${stats.multiplier.toFixed(3)}, ${toRelPct(stats.incomingMulti - 1, 1)}%)`);
    rightSpan.classList.add("extra-stat-info");
    outerDiv.appendChild(rightSpan);
    return outerDiv;
}

export class SimResultData<ResultType extends SimResult> {
    constructor(
        public readonly simInst: Simulation<ResultType, any, any>,
        public readonly result: SimCurrentResult<ResultType>
    ) {
    }

    isFinalState(): boolean {
        return this.result.status === 'Done' || this.result.status === 'Not Run' || this.result.status === 'Error';
    }
}

/**
 * A table of gear sets
 */
export class GearPlanTable extends CustomTable<CharacterGearSet, GearSetSel> {

    private readonly sheet: GearPlanSheetGui;

    constructor(sheet: GearPlanSheetGui, setSelection: (item: CharacterGearSet | Simulation<any, any, any> | SimResultData<any> | undefined) => void) {
        super();
        this.sheet = sheet;
        this.classList.add("gear-plan-table");
        this.classList.add("hoverable");
        this.setupColumns();
        const selModel = new SingleSelectionModel<CharacterGearSet, GearSetSel>();
        this.selectionModel = selModel;
        selModel.addListener({
            onNewSelection(newSelection: GearSetSel) {
                if (newSelection instanceof CustomRow) {
                    setSelection(newSelection.dataItem);
                }
                else if (newSelection instanceof CustomColumn && newSelection.dataValue['makeConfigInterface']) {
                    setSelection(newSelection.dataValue as Simulation<any, any, any>);
                }
                else if (newSelection instanceof CustomCell && newSelection.colDef.dataValue?.spec) {
                    setSelection(new SimResultData(newSelection.colDef.dataValue, newSelection.cellValue));
                }
                else if (newSelection === undefined) {
                    setSelection(undefined);
                }
            }
        })
    }

    get sims(): Simulation<any, any, any>[] {
        return this.sheet.sims;
    }

    get gearSets(): CharacterGearSet[] {
        return this.sheet.sets;
    }

    selectGearSet(set: CharacterGearSet | undefined) {
        console.log('selectGearSet');
        if (set === undefined) {
            this.selectionModel.clearSelection();
        }
        else {
            const row: CustomRow<CharacterGearSet> = this.dataRowMap.get(set);
            if (row) {
                this.selectionModel.clickRow(row);
                scrollIntoView(row);
            }
            else {
                console.log(`Tried to select set ${set.name}, but couldn't find it in our row mapping.`);
            }
        }
        this.refreshSelection();
    }

    dataChanged() {
        const curSelection = this.selectionModel.getSelection();
        super.data = [new HeaderRow(), ...this.gearSets];
        // Special case for deleting the currently selected row
        if (curSelection instanceof CustomRow && !(this.gearSets.includes(curSelection.dataItem))) {
            this.selectionModel.clearSelection();
        }
    }

    simsChanged() {
        // If we are deleting a sim, need to deselect it
        const curSelection = this.selectionModel.getSelection();
        if (curSelection instanceof CustomColumn) {
            const selectedItem = curSelection.dataValue;
            if ('simulate' in selectedItem && !this.sims.includes(selectedItem)) {
                this.selectionModel.clearSelection();
            }
        }
        // TODO: also select a new sim when adding it
        this.setupColumns();
    }

    //
    // addSim(sim: Simulation<any, any, any>) {
    //     this._sims.push(sim);
    //     this.setupColumns();
    // }
    //
    // delSim(sim: Simulation<any, any, any>) {
    //     this._sims = this._sims.filter(s => s !== sim);
    //     this.setupColumns();
    // }

    private setupColumns() {
        const viewOnly = this.sheet._isViewOnly;
        if (viewOnly) {
            // TODO: this leaves 1px extra to the left of the name columns
            // Also messes with the selection outline
            // this.style.setProperty('--action-col-width', '1px');
            this.style.setProperty('--action-col-width', '4px');
            this.classList.add('view-only');
        }
        else {
            this.classList.add('editable');
        }
        const statColWidth = 40;
        // const chanceStatColWidth = viewOnly ? 110 : 160;
        // const multiStatColWidth = viewOnly ? 70 : 120;

        const jobData = getClassJobStats(this.sheet.classJobName);

        const gcdColumns: typeof this.columns = [];
        const override = jobData.gcdDisplayOverrides?.(this.sheet.level);
        if (override) {
            let counter = 0;
            for (const gcdOver of override) {
                gcdColumns.push({
                    shortName: "gcd-custom-" + counter++,
                    displayName: gcdOver.shortLabel,
                    getter: gearSet => {
                        const haste = gearSet.computedStats.haste(gcdOver.attackType) + (gcdOver.haste ?? 0);
                        switch (gcdOver.basis) {
                            case "sks":
                                return gearSet.computedStats.gcdPhys(2.5, haste);
                            case "sps":
                                return gearSet.computedStats.gcdMag(2.5, haste);
                            default:
                                return null;
                        }
                    },
                    rowCondition: noSeparators,
                    renderer: gcd => document.createTextNode(gcd.toFixed(2)),
                    initialWidth: statColWidth + 10,
                })
            }
        }
        else {
            gcdColumns.push(
                {
                    shortName: "gcd",
                    displayName: "GCD",
                    getter: gearSet => {
                        const magHaste = gearSet.computedStats.haste('Spell');
                        const physHaste = gearSet.computedStats.haste('Weaponskill');
                        return Math.min(gearSet.computedStats.gcdMag(2.5, magHaste), gearSet.computedStats.gcdPhys(2.5, physHaste));
                    },
                    renderer: gcd => document.createTextNode(gcd.toFixed(2)),
                    rowCondition: noSeparators,
                    initialWidth: statColWidth + 10,
                });
        }

        const simColumns: typeof this.columns = this.sims.map(sim => {
            return {
                dataValue: sim,
                shortName: "sim-col-" + sim.shortName,
                get displayName() {
                    return sim.displayName;
                },
                getter: gearSet => this.sheet.getSimResult(sim, gearSet),
                renderer: result => new SimResultMiniDisplay(this, sim, result),
                // TODO: improve this
                colStyler: (value, colElement) => {
                    colElement.classList.add('hoverable');
                },
                allowHeaderSelection: true,
                allowCellSelection: true,
                // TODO: make this not display if the sim has no settings
                headerStyler: (value, colHeader) => {
                    const span = document.createElement('span');
                    span.textContent = '⛭';
                    span.classList.add('header-cell-detail', 'header-cell-gear');
                    colHeader.append(span);
                    colHeader.classList.add('hoverable');
                    colHeader.title = 'Click to configure simulation settings';
                },
                rowCondition: noSeparators,
            }
        });

        const outer = this;

        this.columns = [
            {
                shortName: "actions",
                displayName: "",
                getter: gearSet => gearSet,
                renderer: (gearSet: CharacterGearSet) => {
                    const div = document.createElement("div");
                    div.appendChild(makeActionButton([faIcon('fa-trash-can')], (ev) => {
                        if (confirmDelete(ev, `Delete gear set '${gearSet.name}'?`)) {
                            this.sheet.delGearSet(gearSet);
                        }
                    }, 'Delete this set'));
                    div.appendChild(makeActionButton([faIcon('fa-copy')], () => this.sheet.cloneAndAddGearSet(gearSet, true), 'Clone this set'));
                    const dragger = document.createElement('button');
                    dragger.title = 'Drag to re-order this set';
                    dragger.textContent = '≡';
                    dragger.classList.add('drag-handle');
                    let rowBeingDragged: null | CustomRow<CharacterGearSet> = null;
                    let lastDelta: number = 0;
                    installDragHelper({
                        dragHandle: dragger,
                        dragOuter: outer,
                        downHandler: (ev) => {
                            let target = ev.target;
                            while (target) {
                                if (target instanceof CustomRow) {
                                    console.log('Drag start: ' + target);
                                    rowBeingDragged = target;
                                    rowBeingDragged.classList.add('dragging');
                                    return;
                                }
                                else {
                                    target = target['parentElement'];
                                }
                            }
                            rowBeingDragged = null;
                        },
                        moveHandler: (ev) => {
                            // let target = ev.target;
                            const dragY = ev.clientY;
                            const target = this._rows.find(row => {
                                const el = row.element;
                                if (!el || el === rowBeingDragged) {
                                    return false;
                                }
                                const br = el.getBoundingClientRect();
                                return br.y <= dragY && dragY <= (br.y + br.height);
                            });
                            if (target instanceof CustomRow) {
                                const toIndex = this.sheet.sets.indexOf(target.dataItem);
                                this.sheet.reorderSet(gearSet, toIndex);
                            }
                            if (rowBeingDragged) {
                                const rect = rowBeingDragged.getBoundingClientRect();
                                const delta = ev.pageY - (rect.y - lastDelta) - (rect.height / 2);
                                lastDelta = delta;
                                rowBeingDragged.style.top = `${delta}px`;
                            }
                        },
                        upHandler: () => {
                            this.sheet.requestSave();
                            lastDelta = 0;
                            rowBeingDragged.style.top = '';
                            rowBeingDragged.classList.remove('dragging');
                            console.log('Drag end');
                            rowBeingDragged = null;
                        }
                    });
                    div.appendChild(dragger);
                    return div;
                }
            },
            {
                shortName: "setname",
                displayName: "Set Name",
                getter: (gearSet => gearSet),
                renderer: (value: CharacterGearSet) => {
                    const nameSpan = document.createElement('span');
                    const elements: Element[] = [nameSpan];
                    nameSpan.textContent = value.name;
                    const trimmedDesc = value.description?.trim();
                    let title = value.name;
                    // Description is only on view-only mode
                    if (viewOnly) {
                        const descSpan = document.createElement('span');
                        elements.push(descSpan);
                        if (trimmedDesc) {
                            descSpan.textContent = trimmedDesc;
                        }
                    }
                    if (trimmedDesc) {
                        title += '\n' + trimmedDesc;
                    }
                    const issues = value.results.issues;
                    if (issues.length > 0) {
                        const icon = iconForIssues(...issues);
                        icon.classList.add('gear-set-issue-icon');
                        nameSpan.prepend(icon);
                        // elements.unshift(icon);
                        // div.appendChild(icon);
                        title += '\nThis set has problems:';
                        for (const issue of issues) {
                            let titlePart = `${capitalizeFirstLetter(issue.severity)}: ${issue.description}`;
                            if (issue.affectedSlots) {
                                titlePart += ` (${issue.affectedSlots.join(', ')})`
                            }
                            title += '\n - ' + titlePart;
                        }
                    }
                    const div = document.createElement('div');
                    div.classList.add('set-name-desc-holder');
                    div.replaceChildren(...elements);
                    div.title = title;
                    if (value.isSeparator) {
                        nameSpan.style.fontWeight = 'bold';
                    }
                    return div;
                }
                // initialWidth: 300,
            },
            ...(viewOnly ? simColumns : []),
            ...gcdColumns,
            {
                shortName: "wd",
                displayName: "WD",
                getter: gearSet => ({
                    stat: Math.max(gearSet.computedStats.wdMag, gearSet.computedStats.wdPhys),
                    multiplier: gearSet.computedStats.wdMulti
                }),
                initialWidth: statColWidth,
                renderer: multiplierStatTooltip,
                extraClasses: ['stat-col'],
                rowCondition: noSeparators,
            } as CustomColumnSpec<CharacterGearSet, MultiplierStat>,
            {
                shortName: "hp",
                displayName: "HP",
                getter: gearSet => gearSet.computedStats.hp,
                extraClasses: ['stat-col', 'stat-col-hp'],
                rowCondition: noSeparators,
            },
            {
                ...mainStatCol(this.sheet, 'dexterity'),
                shortName: 'dex',
            },
            {
                ...mainStatCol(this.sheet, 'strength'),
            },
            {
                ...mainStatCol(this.sheet, 'mind'),
            },
            {
                ...mainStatCol(this.sheet, 'intelligence'),
                shortName: 'int',
            },
            {
                shortName: "crit",
                displayName: "CRT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.crit,
                    chance: gearSet.computedStats.critChance,
                    multiplier: gearSet.computedStats.critMulti
                }) as ChanceStat,
                renderer: chanceStatDisplay,
                condition: () => this.sheet.isStatRelevant('crit'),
                extraClasses: ['stat-col', 'chance-stat-col'],
                rowCondition: noSeparators,
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.dhit,
                    chance: gearSet.computedStats.dhitChance,
                    multiplier: gearSet.computedStats.dhitMulti
                }) as ChanceStat,
                renderer: chanceStatDisplay,
                condition: () => this.sheet.isStatRelevant('dhit'),
                extraClasses: ['stat-col', 'chance-stat-col'],
                rowCondition: noSeparators,
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: gearSet => ({
                    stat: gearSet.computedStats.determination,
                    multiplier: gearSet.computedStats.detMulti
                }) as MultiplierStat,
                renderer: multiplierStatDisplay,
                condition: () => this.sheet.isStatRelevant('determination'),
                extraClasses: ['stat-col', 'multiplier-stat-col'],
                rowCondition: noSeparators,
            },
            {
                ...tooltipMultiStatCol(this.sheet, 'skillspeed', 'sksDotMulti'),
                shortName: "sks",
                displayName: "SKS",
            },
            {
                ...tooltipMultiStatCol(this.sheet, 'spellspeed', 'spsDotMulti'),
                shortName: "sps",
                displayName: "SPS",
            },
            {
                shortName: "piety",
                displayName: "PIE",
                getter: gearSet => gearSet.computedStats.piety,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('piety'),
                rowCondition: noSeparators,
            },
            {
                shortName: "tenacity",
                displayName: "TNC",
                getter: gearSet => ({
                    stat: gearSet.computedStats.tenacity,
                    multiplier: gearSet.computedStats.tncMulti,
                    incomingMulti: gearSet.computedStats.tncIncomingMulti
                }) as MultiplierMitStat,
                renderer: multiplierMitStatDisplay,
                condition: () => this.sheet.isStatRelevant('tenacity'),
                extraClasses: ['stat-col', 'multiplier-mit-stat-col'],
                rowCondition: noSeparators,
            },
            ...(viewOnly ? [] : simColumns),
        ];
    }

    // TODO: this is kinda bad, cross-talk between columns despite there being no reason to do so,
    // plus you want changes to immediately invalidate. I guess setting the inactivity time to 0 works?
    private dirtySimColColors: Simulation<any, any, any>[] = [];
    private readonly simColColorsTimer = new Inactivitytimer(0, () => this.reprocessSimColsColor());

    requestProcessSimColColor(sim: Simulation<any, any, any>) {
        if (!this.dirtySimColColors.includes(sim)) {
            this.dirtySimColColors.push(sim);
            this.simColColorsTimer.ping();
        }
    }

    reprocessSimColsColor() {
        for (const sim of this.dirtySimColColors) {
            this.reprocessSimColColor(sim);
        }
        this.dirtySimColColors = [];
    }

    reprocessAllSimColColors() {
        this.dirtySimColColors = [...this.sims];
        this.simColColorsTimer.ping();
    }

    reprocessSimColColor(sim: Simulation<any, any, any>) {
        const col = this.columns.find(col => col.dataValue === sim);
        if (!col) {
            return;
        }
        const cells: CustomCell<any, any>[] = this._rows.flatMap(row => {
            if (row instanceof CustomRow) {
                const cell = row.dataColMap.get(col);
                if (cell && cell.cellValue !== null) {
                    return [cell];
                }
            }
            return [];
        });
        let invalid = false;
        const processed: [CustomCell<any, any>, number][] = [];
        for (const cell of cells) {
            const value: SimCurrentResult<SimResult> = cell.cellValue;
            if (value.status !== 'Done') {
                invalid = true;
                break;
            }
            processed.push([cell, value.result.mainDpsResult]);
        }
        cells.forEach(cell => cell.classList.remove('sim-column-worst'));
        cells.forEach(cell => cell.classList.remove('sim-column-best'));
        cells.forEach(cell => cell.classList.remove('sim-column-valid'));
        if (cells.length < 2) {
            return;
        }
        else if (invalid) {
            cells.forEach(cell => cell.classList.add('sim-column-pending'));
        }
        else {
            cells.forEach(cell => cell.classList.remove('sim-column-pending'));
            processed.sort((cellA, cellB) => (cellA[1] - cellB[1]));
            const worst = processed[0];
            const best = processed[processed.length - 1];
            let worstValue = worst[1];
            const bestValue = best[1];
            let delta = bestValue - worstValue;
            if (delta === 0) {
                return;
            }
            if (bestValue > 0) {
                // If less than 0.5% difference
                const minDeltaRelative = 0.001;
                if (delta / bestValue < minDeltaRelative) {
                    delta = bestValue * minDeltaRelative;
                    worstValue = bestValue - delta;
                }
            }
            for (const [cell, value] of processed) {
                cell.classList.add('sim-column-valid');
                const relative = (value - worstValue) / delta * 100;
                cell.style.setProperty('--sim-result-relative', relative.toFixed(1) + '%');
                if (value === bestValue) {
                    cell.classList.add('sim-column-best');
                }
                else if (value === worstValue) {
                    cell.classList.add('sim-column-worst');
                }
            }
        }
    }

}

export class SimResultDetailDisplay<X extends SimResult> extends HTMLElement {
    private _result: SimCurrentResult<X>;
    private sim: Simulation<X, any, any>;

    constructor(simDetailResultDisplay: SimResultData<any>) {
        super();
        this._result = simDetailResultDisplay.result;
        this.sim = simDetailResultDisplay.simInst;
        // If this is an unfinished state (i.e. sim still running), update now, then update again when the promise
        // returns.
        if (!simDetailResultDisplay.isFinalState()) {
            this.update();
        }
        this._result.resultPromise.then(result => this.update(), error => this.update());
    }

    update() {
        if (this._result.status === 'Done') {
            if (this.sim.makeResultDisplay) {
                this.replaceChildren(this.sim.makeResultDisplay(this._result.result))
            }
            else {
                // TODO: style this properly
                const tbl = simpleAutoResultTable(this._result.result);
                tbl.classList.add('sim-basic-result-table');
                this.replaceChildren(tbl);
            }
        }
        else {
            this.textContent = this._result.status;
        }
        // this.gearPlanTable.requestProcessSimColColor(this.sim);
    }
}

export function textWithToolTip(text: string, tooltip: string): HTMLElement {
    const span = document.createElement('span');
    span.textContent = text;
    span.title = tooltip;
    return span;
}

export class SimResultMiniDisplay extends HTMLElement {
    private _result: SimCurrentResult<any>;

    constructor(private gearPlanTable: GearPlanTable, private sim: Simulation<any, any, any>, simCurrentResult: SimCurrentResult<any>) {
        super();
        this._result = simCurrentResult;
        this.update();
        this._result.resultPromise.then(result => this.update(), error => this.update());
    }

    update() {
        if (this._result.status === 'Done') {
            const result = this._result.result;
            if (result === undefined || result.mainDpsResult === undefined) {
                console.error("Result was undefined");
                this.textContent = "Error!";
                return;
            }
            if (Number.isNaN(result.mainDpsResult)) {
                console.error("Result was undefined");
                this.textContent = "Error!";
                return;
            }
            this.textContent = result.mainDpsResult.toFixed(2);
            let tooltip: string;
            if (this.sim.makeToolTip) {
                tooltip = this.sim.makeToolTip(this._result.result);
            }
            else {
                tooltip = Object.entries(result).map(entry => `${camel2title(entry[0])}: ${entry[1]}`)
                    .join('\n');
            }
            this.setAttribute('title', tooltip + '\nClick to view detailed results');
        }
        else {
            this.textContent = this._result.status;
        }
        this.gearPlanTable.requestProcessSimColColor(this.sim);
    }
}

function stringToParagraphs(text: string): HTMLParagraphElement[] {
    return text.trim().split('\n').map(line => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
    })
}

/**
 * The set editor portion. Includes the tab as well as controls for the set name and such.
 */
export class GearSetEditor extends HTMLElement {
    private readonly sheet: GearPlanSheet;
    private readonly gearSet: CharacterGearSet;
    private gearTables: GearItemsTable[] = [];
    private header: HTMLHeadingElement;
    private desc: HTMLDivElement;
    private issuesButtonContent: HTMLSpanElement;

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.sheet = sheet;
        this.gearSet = gearSet;
        this.setup();
    }

    formatTitleDesc() {
        this.header.textContent = this.gearSet.name;
        const trimmedDesc = this.gearSet.description?.trim();
        if (trimmedDesc) {
            this.desc.style.display = '';
            this.desc.replaceChildren(...stringToParagraphs(trimmedDesc));
        }
        else {
            this.desc.style.display = 'none';
        }
    }

    checkIssues() {
        const issues = this.gearSet.issues;
        if (issues.length >= 1) {
            this.issuesButtonContent.replaceChildren(iconForIssues(...issues), `${issues.length} issue${issues.length === 1 ? '' : 's'}`);
        }
        else {
            this.issuesButtonContent.replaceChildren('No issues');
        }
    }

    setup() {
        // const header = document.createElement("h1");
        // header.textContent = "Gear Set Editor";
        // this.appendChild(header)
        this.replaceChildren();

        // Name editor
        // const nameEditor = new FieldBoundTextField(this.gearSet, 'name');
        // nameEditor.classList.add("gear-set-name-editor");
        // this.appendChild(nameEditor);

        this.header = document.createElement('h2');
        this.desc = document.createElement('div');
        this.appendChild(this.header);
        this.appendChild(this.desc);
        this.formatTitleDesc();

        this.issuesButtonContent = document.createElement('span');

        const issuesButton = makeActionButton([this.issuesButtonContent], () => {
            this.showIssuesModal();
        });
        issuesButton.classList.add('issues-button');

        const buttonArea = quickElement('div', ['gear-set-editor-button-area', 'button-row'], [
            makeActionButton('Export This Set', () => {
                startExport(this.gearSet);
            }),
            makeActionButton('Change Name/Description', () => {
                startRenameSet(writeProxy(this.gearSet, () => this.formatTitleDesc()));
            }),
            issuesButton
        ]);

        this.appendChild(buttonArea);

        // Put items in categories by slot
        // Not enough to just use the items, because rings can be in either ring slot, so we
        // need options to reflect that.
        const itemMapping: Map<DisplayGearSlot, GearItem[]> = new Map();
        this.sheet.itemsForDisplay.forEach((item) => {
            const slot = item.displayGearSlot;
            if (itemMapping.has(slot)) {
                itemMapping.get(slot).push(item);
            }
            else {
                itemMapping.set(slot, [item]);
            }
        });

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

        const weaponTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, this.sheet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon']);
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        this.gearTables = [weaponTable];

        for (const slot of leftSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot]);
            leftSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        for (const slot of rightSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot]);
            rightSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        // const leftSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Head', 'Body', 'Hand', 'Legs', 'Feet']);
        // const rightSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight']);

        const gearTableSet = document.createElement('div');
        weaponTable.classList.add('weapon-table');
        gearTableSet.classList.add('gear-table-sides-holder');
        leftSideDiv.classList.add('left-side-gear-table');
        rightSideDiv.classList.add('right-side-gear-table');

        gearTableSet.appendChild(leftSideDiv);
        gearTableSet.appendChild(rightSideDiv);
        this.appendChild(weaponTable);
        this.appendChild(gearTableSet);
        // this.appendChild(rightSideDiv);

        // // Gear table
        // const gearTable = new GearItemsTable(sheet, gearSet, itemMapping);
        // // gearTable.id = "gear-items-table";
        // this.appendChild(gearTable);

        // Food table
        const foodTable = new FoodItemsTable(this.sheet, this.gearSet);
        foodTable.classList.add('food-table');
        // foodTable.id = "food-items-table";
        this.appendChild(foodTable);
        this.checkIssues();
    }

    refreshMateria() {
        this.gearTables.forEach(tbl => tbl.refreshMateria());
        this.checkIssues();
    }

    showIssuesModal(): void {
        new SetIssuesModal(this.gearSet).attachAndShow();
    }

    refresh() {
        this.checkIssues();
    }
}

export class SeparatorEditor extends HTMLElement {
    private readonly gearSet: CharacterGearSet;
    private header: HTMLHeadingElement;
    private desc: HTMLDivElement;

    constructor(gearSet: CharacterGearSet) {
        super();
        this.gearSet = gearSet;
        this.setup();
    }

    formatTitleDesc() {

        this.header.textContent = this.gearSet.name;
        const trimmedDesc = this.gearSet.description?.trim();
        if (trimmedDesc) {
            this.desc.style.display = '';
            this.desc.replaceChildren(...stringToParagraphs(trimmedDesc));
        }
        else {
            this.desc.style.display = 'none';
        }
    }


    setup() {

        this.replaceChildren();

        this.header = document.createElement('h2');
        this.desc = document.createElement('div');
        this.appendChild(this.header);
        this.appendChild(this.desc);
        this.formatTitleDesc();

        const buttonArea = quickElement('div', ['gear-set-editor-button-area', 'button-row'], [
            makeActionButton('Change Name/Description', () => {
                startRenameSet(writeProxy(this.gearSet, () => this.formatTitleDesc()));
            }),
        ]);

        this.appendChild(buttonArea);
    }

    // TODO: clean up this issue
    refresh() {

    }
}

/**
 * A simplified, read-only view for a set
 */
export class GearSetViewer extends HTMLElement {
    private readonly sheet: GearPlanSheet;
    private readonly gearSet: CharacterGearSet;

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.sheet = sheet;
        this.gearSet = gearSet;
        this.setup();
    }

    setup() {
        // const header = document.createElement("h1");
        // header.textContent = "Gear Set Editor";
        // this.appendChild(header)
        this.replaceChildren();

        // Name editor
        const heading = document.createElement('h1');
        if (this.sheet.isEmbed) {
            const headingLink = document.createElement('a');
            const hash = getCurrentHash();
            const linkUrl = makeUrl(...hash.slice(1));
            headingLink.href = linkUrl.toString();
            headingLink.target = '_blank';
            headingLink.replaceChildren(this.gearSet.name, faIcon('fa-arrow-up-right-from-square', 'fa'));
            heading.replaceChildren(headingLink);
        }
        else {
            heading.textContent = this.gearSet.name;
        }
        this.appendChild(heading);

        if (this.gearSet.description) {
            const descContainer = quickElement('div', [], stringToParagraphs(this.gearSet.description));
            this.appendChild(descContainer);
        }

        const anchorForEmbed = document.createElement('a');
        anchorForEmbed.id = 'embed-stats-placeholder';
        this.appendChild(anchorForEmbed);

        const matTotals = new MateriaTotalsDisplay(this.gearSet);
        if (!matTotals.empty) {
            this.appendChild(matTotals);
        }

        // const buttonArea = quickElement('div', ['gear-set-editor-button-area', 'button-row'], [
        //     makeActionButton('Switch to Edit Mode', () => {
        //         alert('Not Implemented Yet');
        //     }),
        //     // TODO
        //     makeActionButton('Copy Link to Set', () => {
        //         alert('Not Implemented Yet');
        //         // startShortLink(JSON.stringify(this.sheet.exportGearSet(this.gearSet, true)));
        //     }),
        //     makeActionButton('Copy Set as JSON', () => {
        //         alert('Not Implemented Yet');
        //         // navigator.clipboard.writeText(JSON.stringify(this.sheet.exportGearSet(this.gearSet, true)));
        //     })
        // ]);
        //
        // this.appendChild(buttonArea);

        // We only care about equipped items
        const itemMapping: Map<EquipSlotKey, GearItem> = new Map();
        const equippedSlots = [];
        for (const slot of EquipSlots) {
            const equipped: GearItem = this.gearSet.getItemInSlot(slot);
            if (equipped) {
                itemMapping.set(slot, equipped);
                equippedSlots.push(slot);
            }
        }

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

        if (itemMapping.get('Weapon') || itemMapping.get('OffHand')) {
            const weaponTable = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, this.sheet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon']);
            weaponTable.classList.add('weapon-table');
            this.appendChild(weaponTable);
        }
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        let leftEnabled = false;
        let rightEnabled = false;
        for (const slot of leftSideSlots) {
            if (itemMapping.get(slot)) {
                const table = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, [slot]);
                leftSideDiv.appendChild(table);
                leftEnabled = true;
            }
        }
        for (const slot of rightSideSlots) {
            if (itemMapping.get(slot)) {
                const table = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, [slot]);
                rightSideDiv.appendChild(table);
                rightEnabled = true;
            }
        }
        // const leftSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Head', 'Body', 'Hand', 'Legs', 'Feet']);
        // const rightSideTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight']);

        const gearTableSet = document.createElement('div');
        gearTableSet.classList.add('gear-table-sides-holder');
        leftSideDiv.classList.add('left-side-gear-table');
        rightSideDiv.classList.add('right-side-gear-table');

        if (leftEnabled) {
            gearTableSet.appendChild(leftSideDiv);
        }
        if (rightEnabled) {
            gearTableSet.appendChild(rightSideDiv);
        }
        this.appendChild(gearTableSet);

        // Food table TODO make readonly
        const food = this.gearSet.food;
        if (food) {
            const foodTable = new FoodItemViewTable(this.sheet, food);
            foodTable.classList.add('food-view-table');
            // foodTable.id = "food-items-table";
            this.appendChild(foodTable);
        }
    }

    get toolbar(): Node {
        return new SetViewToolbar(this.gearSet);
    }

    refresh() {
        // Avoids an error in the console in view-only mode
    }
}

export class SeparatorViewer extends HTMLElement {
    private readonly gearSet: CharacterGearSet;

    constructor(gearSet: CharacterGearSet) {
        super();
        this.gearSet = gearSet;
        this.setup();
    }

    setup() {
        this.replaceChildren();

        // Name editor
        const heading = document.createElement('h1');
        heading.textContent = this.gearSet.name;
        this.appendChild(heading);

        if (this.gearSet.description) {
            const descContainer = quickElement('div', [], stringToParagraphs(this.gearSet.description));
            this.appendChild(descContainer);
        }
    }

    refresh() {
        // Avoids an error in the console in view-only mode
    }
}

function formatSimulationConfigArea<SettingsType extends SimSettings>(
    sheet: GearPlanSheet,
    sim: Simulation<any, SettingsType, any>,
    refreshColumn: (item: Simulation<any, SettingsType, any>) => void,
    deleteColumn: (item: Simulation<any, SettingsType, any>) => void,
    refreshHeaders: () => void): HTMLElement {

    const outerDiv = document.createElement("div");
    outerDiv.id = 'sim-config-area-outer';
    outerDiv.classList.add('sim-config-area-outer');

    // const header = document.createElement("h1");
    // header.textContent = "Configuring " + sim.displayName;
    // outerDiv.appendChild(header);
    if (sheet._isViewOnly) {
        const title = document.createElement('h1');
        title.textContent = sim.displayName;
    }
    else {
        const titleEditor = new FieldBoundTextField(sim, 'displayName');
        titleEditor.addListener(val => {
            refreshHeaders();
        });
        titleEditor.classList.add('sim-name-editor');
        titleEditor.title = 'Rename this simulation';
        outerDiv.appendChild(titleEditor);
        const deleteButton = makeActionButton("Delete", () => deleteColumn(sim));
        outerDiv.appendChild(deleteButton);
    }
    const auto = !sim.manualRun;
    const rerunAction = () => refreshColumn(sim);
    if (!auto) {
        const rerunButton = makeActionButton("Rerun", rerunAction);
        outerDiv.appendChild(rerunButton);
    }
    const rerunTimer = new Inactivitytimer(300, rerunAction);

    const originalSettings: SettingsType = sim.settings;
    const updateCallback = () => {
        sheet.requestSave();
        if (auto) {
            rerunTimer.ping();
        }
    };
    const settingsProxyHandler: ProxyHandler<SettingsType> = {
        set(target, prop, value, receiver) {
            target[prop] = value;
            updateCallback();
            return true;
        }
    };
    const settingsProxy = new Proxy(originalSettings, settingsProxyHandler);
    const customInterface = sim.makeConfigInterface(settingsProxy, updateCallback);
    customInterface.id = 'sim-config-area-inner';
    customInterface.classList.add('sim-config-area-inner');
    outerDiv.appendChild(customInterface);

    return outerDiv;
}

export class GearPlanSheetElement extends HTMLElement {

}

/**
 * The top-level gear manager, but with graphical support
 */
export class GearPlanSheetGui extends GearPlanSheet {

    protected _materiaAutoFillController: MateriaAutoFillController;
    private gearUpdateTimer: Inactivitytimer;
    private _sheetSetupDone: boolean = false;
    private readonly element: GearPlanSheetElement;
    // Sub-elements
    private _gearPlanTable: GearPlanTable;
    // private buttonRow: HTMLDivElement;
    private readonly _loadingScreen: LoadingBlocker;
    private _gearEditToolBar: GearEditToolbar;
    private _selectFirstRowByDefault: boolean = false;
    readonly headerArea: HTMLDivElement;
    readonly tableArea: HTMLDivElement;
    readonly tableHolderOuter: HTMLDivElement;
    readonly tableHolder: HTMLDivElement;
    readonly buttonsArea: HTMLDivElement;
    readonly editorArea: HTMLDivElement;
    readonly midBarArea: HTMLDivElement;
    readonly toolbarHolder: HTMLDivElement;
    // TODO: SimResult alone might not be enough since we'd want it to refresh automatically if settings are changed
    private _editorItem: CharacterGearSet | Simulation<any, any, any> | SimResultData<SimResult> | undefined;

    // Can't make ctor private for custom element, but DO NOT call this directly - use fromSaved or fromScratch
    constructor(...args: ConstructorParameters<typeof GearPlanSheet>) {
        super(...args);
        this.element = new GearPlanSheetElement();
        const element = this.element;
        element.classList.add('gear-sheet');
        element.classList.add('loading');
        this.headerArea = document.createElement('div');
        this.headerArea.classList.add('header-area');
        this.tableArea = document.createElement("div");
        this.tableArea.classList.add('gear-sheet-table-area', 'hide-when-loading');
        this.tableHolder = document.createElement('div');
        this.tableHolder.classList.add('gear-sheet-table-holder');
        this.tableHolderOuter = document.createElement('div');
        this.tableHolderOuter.classList.add('gear-sheet-table-holder-outer');
        this.tableHolderOuter.appendChild(this.tableHolder);
        this.tableArea.appendChild(this.tableHolderOuter);
        this.buttonsArea = document.createElement("div");
        this.buttonsArea.classList.add('gear-sheet-buttons-area', 'hide-when-loading', 'show-hide-parent');
        this.editorArea = document.createElement("div");
        this.editorArea.classList.add('gear-sheet-editor-area', 'hide-when-loading');
        this.midBarArea = document.createElement("div");
        this.midBarArea.classList.add('gear-sheet-midbar-area', 'hide-when-loading');
        this.toolbarHolder = document.createElement('div');
        this.toolbarHolder.classList.add('gear-sheet-toolbar-holder', 'hide-when-loading');
        element.appendChild(this.headerArea);
        element.appendChild(this.tableArea);
        element.appendChild(this.midBarArea);
        element.appendChild(this.editorArea);
        this.midBarArea.append(this.toolbarHolder);

        const flexPadding = quickElement('div', ['flex-padding-item'], []);
        element.appendChild(flexPadding);

        // Early gui setup
        this._loadingScreen = new LoadingBlocker();
        element.appendChild(this._loadingScreen);
        this.setupEditorArea();
    }

    get showAdvancedStats() {
        return super.showAdvancedStats;
    }

    set showAdvancedStats(show: boolean) {
        super.showAdvancedStats = show;
        SETTINGS.viewDetailedStats = show;
        if (show) {
            this._gearPlanTable.classList.add('show-advanced-stats');
        }
        else {
            this._gearPlanTable.classList.remove('show-advanced-stats');
        }
    }

    setViewOnly() {
        super.setViewOnly();
        this.element.classList.add("view-only");
    }

    setSelectFirstRowByDefault() {
        this._selectFirstRowByDefault = true;
    }

    private get editorItem() {
        return this._editorItem;
    }

    private set editorItem(item: typeof this._editorItem) {
        this._editorItem = item;
        if (this._isViewOnly) {
            this.headerArea.style.display = 'none';
        }
        this.resetEditorArea();
    }

    get isViewOnly() {
        return super.isViewOnly;
    }

    get setupDone() {
        return this._sheetSetupDone && super.setupDone;
    }

    private resetEditorArea() {
        const item = this._editorItem;
        try {
            if (!item) {
                this.setupEditorArea();
            }
            else if (item instanceof CharacterGearSet) {
                // TODO: centralize these debugging shortcuts
                window['currentGearSet'] = item;
                if (item.isSeparator) {
                    if (this._isViewOnly) {
                        this.setupEditorArea(new SeparatorViewer(item));
                    }
                    else {
                        this.setupEditorArea(new SeparatorEditor(item));
                    }
                }
                else {
                    if (this._isViewOnly) {
                        this.setupEditorArea(new GearSetViewer(this, item));
                    }
                    else {
                        this.setupEditorArea(new GearSetEditor(this, item));
                    }
                }
                this.refreshToolbar();
            }
            else if (item['makeConfigInterface']) {
                this.setupEditorArea(formatSimulationConfigArea(this, item as Simulation<any, any, any>, col => this._gearPlanTable.refreshColumn(col), col => this.delSim(col), () => this._gearPlanTable.refreshColHeaders()));
            }
            else if (item instanceof SimResultData) {
                this.setupEditorArea(new SimResultDetailDisplay(item));
            }
            else {
                this.setupEditorArea();
            }
        }
        catch (e) {
            console.error("Error in selection change: ", e);
            this.setupEditorArea(document.createTextNode("Error!"));
        }
    }


    setupRealGui() {
        const buttonsArea = this.buttonsArea;
        const showHideButton = makeActionButton('≡', () => {
            const cls = 'showing';
            buttonsArea.classList.contains(cls) ? buttonsArea.classList.remove(cls) : buttonsArea.classList.add(cls);
        });
        showHideButton.classList.add('show-hide-button');
        buttonsArea.appendChild(showHideButton);

        this._gearPlanTable = new GearPlanTable(this, item => this.editorItem = item);
        this.showAdvancedStats = SETTINGS.viewDetailedStats ?? false;
        // Buttons and controls at the bottom of the table
        // this.buttonRow.id = 'gear-sheet-button-row';

        const sheetOptions = new DropdownActionMenu('More Actions...');

        if (!this._isViewOnly) {
            const addRowButton = makeActionButton("New Gear Set", () => {
                const newSet = new CharacterGearSet(this);
                newSet.name = "New Set";
                this.addGearSet(newSet, true);
            });
            buttonsArea.appendChild(addRowButton);

            sheetOptions.addAction({
                label: 'Name/Description',
                action: () => startRenameSheet(this)
            });
            sheetOptions.addAction({
                label: 'Manage Custom Items',
                action: () => new CustomItemPopup(this).attachAndShow(),
            });
            sheetOptions.addAction({
                label: 'Manage Custom Food',
                action: () => new CustomFoodPopup(this).attachAndShow(),
            });
            sheetOptions.addAction({
                label: 'Add Separator',
                action: () => {
                    const set = new CharacterGearSet(this);
                    set.name = 'Separator';
                    set.isSeparator = true;
                    this.addGearSet(set);
                }
            });
            // const renameButton = makeActionButton("Sheet Name/Description", () => {
            //     startRenameSheet(this);
            // });
            // buttonsArea.appendChild(renameButton);
            buttonsArea.appendChild(sheetOptions);
        }


        if (this.ilvlSync != undefined) {
            const span = quickElement('span', [], [document.createTextNode(`ilvl Sync: ${this.ilvlSync}`)]);
            const ilvlSyncLabel = quickElement('div', ['like-a-button'], [span]);
            // ilvlSyncLabel.title = 'To change the item level sync, click the "Save As" button and create a '
            buttonsArea.appendChild(ilvlSyncLabel);
        }

        if (this._isViewOnly) {
            const saveAsButton = makeActionButton("Save As", () => {
                const modal = new SaveAsModal(this, newSheet => openSheetByKey(newSheet.saveKey));
                modal.attachAndShow();
            });
            buttonsArea.appendChild(saveAsButton);
        }
        else {
            sheetOptions.addAction({
                label: 'Save As',
                action: () => {
                    const modal = new SaveAsModal(this, newSheet => openSheetByKey(newSheet.saveKey));
                    modal.attachAndShow();
                },
            });
        }

        if (!this._isViewOnly) {

            const newSimButton = makeActionButton("Add Simulation", () => {
                this.showAddSimDialog();
            });
            buttonsArea.appendChild(newSimButton);

            const exportSheetButton = makeActionButton("Export Whole Sheet", () => {
                startExport(this);
            });
            buttonsArea.appendChild(exportSheetButton);

            const importGearSetButton = makeActionButton("Import Sets", () => {
                this.showImportSetsDialog();
            });
            buttonsArea.appendChild(importGearSetButton);
        }
        else {
            const exportPicker = new DropdownActionMenu("Export...");
            const sheet = this;
            exportPicker.addAction({
                label: "Whole Sheet",
                action: () => startExport(sheet),
            });
            exportPicker.addAction({
                label: "Selected Set",
                action: () => {
                    const selection = sheet.editorItem;
                    if (selection instanceof CharacterGearSet) {
                        startExport(selection);
                    }
                    else {
                        alert("Select a gear set first");
                    }
                },
            });
            buttonsArea.appendChild(exportPicker);
        }

        this.gearUpdateTimer = new Inactivitytimer(1_000, () => {
            if (this._editorAreaNode instanceof GearSetEditor) {
                this._editorAreaNode.setup();
            }
            this.saveData();
        });

        const raceDropdown = new FieldBoundDataSelect<GearPlanSheet, RaceName>(
            this,
            'race',
            r => {
                return r ?? "Select a Race/Clan";
            },
            [undefined, ...Object.keys(RACE_STATS) as RaceName[]]);
        buttonsArea.appendChild(raceDropdown);

        const partySizeDropdown = new FieldBoundDataSelect<GearPlanSheet, PartyBonusAmount>(
            this,
            'partyBonus',
            value => {
                if (value === 0) {
                    return 'No Party Bonus';
                }
                else {
                    return `${value} Unique Roles`;
                }
            },
            rangeInc(0, MAX_PARTY_BONUS)
        );
        buttonsArea.appendChild(partySizeDropdown);

        if (this.saveKey) {
            this.headerArea.style.display = 'none';
        }
        else {
            if (this._isViewOnly) {
                const heading = document.createElement('h1');
                heading.textContent = this.sheetName;
                this.headerArea.appendChild(heading);

                const trimmedDesc = this.description?.trim();
                if (trimmedDesc) {
                    const descArea = quickElement('div', [], stringToParagraphs(trimmedDesc));
                    this.headerArea.append(descArea);
                }

                const helpText = document.createElement('h4');
                helpText.textContent = 'To edit this sheet, click the "Save As" button below the table.';
                this.headerArea.appendChild(helpText);
            }
            else {
                const unsavedWarning = document.createElement('h4');
                unsavedWarning.textContent = 'This imported sheet will not be saved unless you use the "Save As" button below.';
                this.headerArea.appendChild(unsavedWarning);
            }
            this.headerArea.style.display = '';
            const headerButton = makeActionButton('Toggle Header', () => {
                // TODO: if you have manually shown the header, don't hide it again when re-selecting a set
                this.headerArea.style.display = (this.headerArea.style.display === 'none') ? '' : 'none';
            });
            buttonsArea.appendChild(headerButton);
            const advancedStats = makeActionButton('Toggle Details', () => {
                this.showAdvancedStats = !this.showAdvancedStats;
            });
            buttonsArea.appendChild(advancedStats);
        }
        // const tableAreaInner = quickElement('div', ['gear-sheet-table-area-inner'], [this._gearPlanTable, this.buttonsArea]);
        this.tableHolder.appendChild(this._gearPlanTable);
        this.tableHolder.appendChild(buttonsArea);
        try {
            const ro = new ResizeObserver(() => {
                this.fixScroll();
            });
            ro.observe(this.element);
            ro.observe(this.tableArea);
            ro.observe(this.tableHolder);
            ro.observe(this._gearPlanTable);
        }
        catch (e) {
            console.error('Browser does not support ResizeObserver!', e);
        }
        // this.addEventListener('resize', () => {
        //     this.fixScroll();
        // })
        // this.tableArea.addEventListener('resize', () => {
        //     this.fixScroll();
        // })
        // this.tableArea.appendChild(tableAreaInner);
        this._gearPlanTable.dataChanged();
        this._loadingScreen.remove();
        this.element.classList.remove('loading');
        // console.log(`${this._selectFirstRowByDefault} ${this.sets.length}`);


        const outer = this;
        const matFillCtrl: MateriaAutoFillController = {

            get autoFillMode() {
                return outer.materiaFillMode;
            },
            set autoFillMode(mode: MateriaFillMode) {
                outer.materiaFillMode = mode;
                outer.requestSave();
            },
            get prio() {
                return writeProxy<MateriaAutoFillPrio>(outer.materiaAutoFillPrio, () => outer.requestSave());
            },
            callback(): void {
                outer.requestSave();
            },
            fillAll(): void {
                let set;
                if ((set = outer._editorItem) instanceof CharacterGearSet) {
                    set.fillMateria(outer.materiaAutoFillPrio, true);
                    if (outer._editorAreaNode instanceof GearSetEditor) {
                        outer._editorAreaNode.refreshMateria();
                    }
                }
            },
            fillEmpty(): void {
                let set;
                if ((set = outer._editorItem) instanceof CharacterGearSet) {
                    set.fillMateria(outer.materiaAutoFillPrio, false);
                    if (outer._editorAreaNode instanceof GearSetEditor) {
                        outer._editorAreaNode.refreshMateria();
                    }
                }
            },
            // TODO: remove?
            refreshOnly() {
                if (outer._editorAreaNode instanceof GearSetEditor) {
                    // outer._editorAreaNode.refreshMateria();
                }
            }

        };
        this._materiaAutoFillController = matFillCtrl;
        this._gearEditToolBar = new GearEditToolbar(
            this,
            this.itemDisplaySettings,
            // () => this.gearUpdateTimer.ping(),
            () => {
            },
            matFillCtrl
        );

        // safari bad.
        // Somehow, '100%' is being interpreted like 100vh rather than 100% of parent like on every other browser.
        // To work around this, we just watch for resizes of tableArea (the entire upper area) and propagate those
        // resizes to tableHolderOuter (the child of tableArea, which holds tableHolder -> the actual table)
        if (isSafari) {
            let isFirst = true;
            new ResizeObserver(() => {
                // Don't touch anything if nothing is selected, otherwise it will adjust the top portion to take up
                // 100% of the screen and the toolbar/editor area will have nowhere to go.
                if (this._editorAreaNode === undefined) {
                    return;
                }
                const initialHeight = this.tableArea.offsetHeight;
                const newHeightPx = Math.round(initialHeight);
                const newHeight = newHeightPx + 'px';
                this.tableHolderOuter.style.maxHeight = `calc(${newHeight} - 5px)`;
                // We need to fix the height of the outermost portion as well, otherwise it will ping-pong resizes.
                // But we only need to do this once.
                if (isFirst) {
                    this.tableArea.style.minHeight = newHeight;
                    this.tableArea.style.maxHeight = newHeight;
                    this.tableArea.style.flexBasis = newHeight;
                    isFirst = false;
                }
            }).observe(this.tableArea);
        }
        const dragTarget = this.toolbarHolder;
        dragTarget.addEventListener('touchstart', (ev) => {
            if (ev.target === dragTarget && ev.touches.length === 1) {
                ev.preventDefault();
            }
        });
        dragTarget.addEventListener('pointerdown', (ev) => {
            if (ev.target !== dragTarget) {
                return;
            }
            ev.preventDefault();
            const initialY = ev.pageY;
            const initialHeight = this.tableArea.offsetHeight;
            const eventListener = (ev: MouseEvent) => {
                const delta = ev.pageY - initialY;
                const newHeightPx = Math.round(initialHeight + delta);
                const newHeightPct = newHeightPx / document.body.clientHeight * 100;
                // This has minor visual issues (due to fractional pixels resulting in inconsistent inner spacing),
                // but seems to be the best we have.
                const newHeight = newHeightPct + 'vh';
                // Doesn't work
                // const newHeight = `round(up, ${newHeightPct}vh, 1px)`;
                // Doesn't resize when the viewport is resized
                // const newHeight = newHeightPx + 'px'
                this.tableArea.style.minHeight = newHeight;
                this.tableArea.style.maxHeight = newHeight;
                this.tableArea.style.flexBasis = newHeight;
                if (isSafari) {
                    // this.tableHolderOuter.style.maxHeight = newHeight;
                }
            };
            const after = (ev: MouseEvent) => {
                document.removeEventListener('pointermove', eventListener);
                document.removeEventListener('pointerup', after);
            };
            document.addEventListener('pointermove', eventListener);
            document.addEventListener('pointerup', after);
        });

        if (this._selectFirstRowByDefault && this.sets.length >= 1) {
            // First, try to select a real gear set
            const firstNonSeparator = this.sets.find(set => !set.isSeparator);
            // Failing that, just select whatever
            this._gearPlanTable.selectGearSet(firstNonSeparator ?? this.sets[0])
        }
        this._sheetSetupDone = true;
    }

    get topLevelElement() {
        return this.element;
    }

    async load() {
        await super.load();
        this.setupRealGui();
    }

    onGearDisplaySettingsUpdate() {
        this.gearUpdateTimer.ping();
    }

    get materiaAutoFillController() {
        return this._materiaAutoFillController;
    }

    private _editorAreaNode: Node | undefined;

    private setupEditorArea(node: (Node & {
        toolbar?: Node
    }) | undefined = undefined) {
        this._editorAreaNode = node;
        if (node === undefined) {
            this.editorArea.replaceChildren();
            this.editorArea.style.display = 'none';
            this.midBarArea.style.display = 'none';
            this.toolbarHolder.replaceChildren();
        }
        else {
            this.editorArea.replaceChildren(node);
            this.editorArea.style.display = '';
            // midbar should be displayed no matter what since it also provides the visual delineation between
            // the top half and the bottom half, even if it isn't needed for displaying any content.
            this.midBarArea.style.display = '';
            // if ('makeToolBar' in node) {
            if (node instanceof GearSetEditor) {
                this.toolbarHolder.replaceChildren(this._gearEditToolBar);
            }
            else if ('toolbar' in node) {
                this.toolbarHolder.replaceChildren(node.toolbar);
            }
            else {
                this.toolbarHolder.replaceChildren();
            }
        }
    }

    addGearSet(gearSet: CharacterGearSet, select: boolean = false) {
        super.addGearSet(gearSet);
        this._gearPlanTable?.dataChanged();
        gearSet.addListener(() => {
            if (this._gearPlanTable) {
                this._gearPlanTable.refreshRowData(gearSet);
                this.refreshToolbar();
                if (this._editorItem === gearSet) {
                    this._editorAreaNode?.['refresh']();
                }
            }
            this.requestSave();
        });
        if (select && this._gearPlanTable) {
            this._gearPlanTable.selectGearSet(gearSet);
        }
    }

    refreshToolbar() {
        if (this._editorItem instanceof CharacterGearSet) {
            this._gearEditToolBar?.refresh(this._editorItem);
        }
    }

    delGearSet(gearSet: CharacterGearSet) {
        super.delGearSet(gearSet);
        if (this._gearPlanTable) {
            this._gearPlanTable.dataChanged();
            this._gearPlanTable.reprocessAllSimColColors();
        }
    }

    reorderSet(gearSet: CharacterGearSet, to: number) {
        super.reorderSet(gearSet, to);
        this.gearPlanTable?.dataChanged();
    }

    cloneAndAddGearSet(gearSet: CharacterGearSet, select: boolean = true) {
        const cloned = this.importGearSet(this.exportGearSet(gearSet));
        cloned.name = cloned.name + ' copy';
        this.addGearSet(cloned, select);
    }


    addSim(sim: Simulation<any, any, any>) {
        super.addSim(sim);
        this.gearPlanTable?.simsChanged();
    }

    delSim(sim: Simulation<any, any, any>) {
        super.delSim(sim);
        this.gearPlanTable?.simsChanged();
    }

    showAddSimDialog() {
        const addSimDialog = new AddSimDialog(this);
        document.querySelector('body').appendChild(addSimDialog);
        addSimDialog.show();
    }

    get gearPlanTable(): GearPlanTable {
        return this._gearPlanTable;
    }

    private fixScroll() {
        // If the user narrows the window, then scrolls to the right, but then widens the window, the
        // table will now be scrolled right past what it should be able to, and have a large blank area
        // displayed in it.

        // The scrollable element
        const tbl = this.tableHolder;
        const rightExcess = tbl.scrollWidth - this._gearPlanTable.clientWidth;
        if (rightExcess >= 0) {
            const newScrollLeft = tbl.scrollLeft - rightExcess;
            if (tbl.scrollLeft !== newScrollLeft) {
                tbl.scrollLeft = newScrollLeft;
            }
        }
    }


    private showImportSetsDialog() {
        const dialog = new ImportSetsModal(this);
        dialog.attachAndShow();
    }

    get sheetName() {
        return super.sheetName;
    }

    set sheetName(name: string) {
        super.sheetName = name;
        setTitle(this._sheetName);
    }

}

export class ImportSetsModal extends BaseModal {
    private readonly loader: LoadingBlocker;
    private readonly importButton: HTMLButtonElement;
    private readonly textArea: HTMLTextAreaElement;

    constructor(private sheet: GearPlanSheetGui) {
        super();
        this.headerText = 'Import Gear Set(s)';

        const explanation = document.createElement('p');
        explanation.textContent = 'This is for importing gear set(s) into this sheet. If you would like to import a full sheet export (including sim settings) to a new sheet, use the "Import Sheet" at the top of the page. '
            + 'You can import a gear planner URL or JSON, or an Etro URL.';
        this.contentArea.appendChild(explanation);

        const textAreaDiv = document.createElement("div");
        textAreaDiv.id = 'set-import-textarea-holder';

        this.textArea = document.createElement("textarea");
        this.textArea.id = 'set-import-textarea';
        textAreaDiv.appendChild(this.textArea);
        this.loader = new LoadingBlocker();
        this.loader.classList.add('with-bg');


        textAreaDiv.appendChild(this.loader);
        this.contentArea.appendChild(textAreaDiv);
        // textAreaDiv.appendChild(document.createElement("br"));

        this.importButton = makeActionButton("Import", () => this.doImport());
        this.addButton(this.importButton);
        this.addCloseButton();
        this.ready = true;
    }

    get ready() {
        return !this.importButton.disabled;
    }

    set ready(ready: boolean) {
        if (ready) {
            this.loader.hide();
            this.importButton.disabled = false;
        }
        else {
            this.loader.show();
            this.importButton.disabled = true;
        }
    }

    checkJob(plural: boolean, ...importedJobs: JobName[]): boolean {
        const nonMatchingJobs = importedJobs.filter(job => job !== this.sheet.classJobName);
        if (nonMatchingJobs.length > 0) {
            const flaggedJobs = nonMatchingJobs.join(', ');
            // TODO: *try* to import some sims, or at least load up the defaults.
            let msg;
            if (plural) {
                msg = `You are trying to import ${flaggedJobs} set(s) into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            else {
                msg = `You are trying to import a ${flaggedJobs} set into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            return confirm(msg);
        }
        else {
            return true;
        }

    }

    doImport() {
        const text = this.textArea.value.trim();
        const parsed = parseImport(text);
        if (parsed) {
            switch (parsed.importType) {
                case "json":
                    try {
                        this.doJsonImport(parsed.rawData);
                    }
                    catch (e) {
                        console.error('Import error', e);
                        alert('Error importing');
                    }
                    return;
                case "shortlink":
                    this.doAsyncImport(() => getShortLink(decodeURIComponent(parsed.rawUuid)));
                    return;
                case "etro":
                    this.ready = false;
                    Promise.all(parsed.rawUuids.map(getSetFromEtro)).then(sets => {
                        if (!this.checkJob(false, ...sets.map(set => set.job))) {
                            this.ready = true;
                            return;
                        }
                        sets.forEach(set => {
                            this.sheet.addGearSet(this.sheet.importGearSet(set), true);
                        });
                        console.log("Imported set(s) from Etro");
                        this.close();
                    }, err => {
                        this.ready = true;
                        console.error("Error loading set from Etro", err);
                        alert('Error loading Etro set');
                    });
                    return;
                case "bis":
                    this.doAsyncImport(() => getBisSheet(...parsed.path));
                    return;
            }
        }
        console.error("Error loading imported data", text);
        alert('That doesn\'t look like a valid import.');
    }

    doAsyncImport(provider: () => Promise<string>) {
        this.ready = false;
        provider().then(raw => {
            this.doJsonImport(raw);
            this.ready = true;
        }, err => {
            this.ready = true;
            console.error("Error importing set/sheet", err);
            alert('Error loading set/sheet');
        })
    }

    doJsonImport(text: string) {
        const rawImport = JSON.parse(text);
        if ('sets' in rawImport && rawImport.sets.length) {
            if (!this.checkJob(true, rawImport.job)) {
                return;
            }
            // import everything
            if (confirm(`This will import ${rawImport.sets.length} gear sets into this sheet.`)) {
                const sets: SetExport[] = rawImport.sets;
                const imports = sets.map(set => this.sheet.importGearSet(set));
                for (let i = 0; i < imports.length; i++) {
                    // Select the first imported set
                    const set = imports[i];
                    this.sheet.addGearSet(set, i === 0);
                }
            }
            closeModal();
        }
        else if ('name' in rawImport && 'items' in rawImport) {
            if (!this.checkJob(false, rawImport.job)) {
                return;
            }
            this.sheet.addGearSet(this.sheet.importGearSet(rawImport), true);
            closeModal();
        }
        else {
            alert("That doesn't look like a valid sheet or set");
        }

    }
}

export class AddSimDialog extends BaseModal {
    private readonly table: CustomTable<SimSpec<any, any>, SingleCellRowOrHeaderSelect<SimSpec<any, any>>>;
    private _showAllSims: boolean = false;

    constructor(private sheet: GearPlanSheet) {
        super();
        this.id = 'add-sim-dialog';
        this.headerText = 'Add Simulation';
        const form = document.createElement("form");
        form.method = 'dialog';
        this.table = new CustomTable();
        const selModel: SingleSelectionModel<SimSpec<any, any>> = new SingleSelectionModel();
        this.table.selectionModel = selModel;
        this.table.classList.add('hoverable');
        this.table.columns = [
            {
                shortName: 'sim-space-name',
                displayName: 'Name',
                // fixedWidth: 500,
                getter: item => item.displayName,
            }
        ];
        this.table.data = this.sheet.relevantSims;
        const showAllCb = labeledCheckbox('Show sims for other jobs', new FieldBoundCheckBox<AddSimDialog>(this, 'showAllSims'));
        form.appendChild(showAllCb);
        const tableHolder = quickElement('div', ['table-holder'], [this.table]);
        form.appendChild(tableHolder);

        const descriptionArea = document.createElement('div');
        descriptionArea.classList.add('add-sim-description');
        descriptionArea.textContent = 'Select a simulation to see a description';

        const contactArea = quickElement('div', ['add-sim-contact-info-holder'], []);
        const descriptionContactArea = quickElement('div', ['add-sim-lower-area'], [descriptionArea, contactArea]);

        form.appendChild(descriptionContactArea);

        const submitButton = makeActionButton("Add", () => this.submit());
        const cancelButton = makeActionButton("Cancel", () => closeModal());
        this.addButton(submitButton);
        this.addButton(cancelButton);

        selModel.addListener({
            onNewSelection(newSelection) {
                if (newSelection instanceof CustomRow) {
                    submitButton.disabled = false;
                    const desc = newSelection.dataItem.description;
                    if (desc !== undefined) {
                        descriptionArea.textContent = desc;
                        descriptionArea.classList.remove('no-desc');
                    }
                    else {
                        descriptionArea.textContent = '(No Description)';
                        descriptionArea.classList.add('no-desc');
                    }
                    const maintainersElement = simMaintainersInfoElement(newSelection.dataItem);
                    if (maintainersElement) {
                        contactArea.replaceChildren(maintainersElement);
                        contactArea.style.display = '';
                    }
                    else {
                        contactArea.replaceChildren();
                        contactArea.style.display = 'none';
                    }
                }
                else {
                    submitButton.disabled = true;
                }
            }
        });
        this.contentArea.append(form);
    }

    submit() {
        const sel = this.table.selectionModel.getSelection();
        if (sel instanceof CustomRow) {
            this.sheet.addSim(sel.dataItem.makeNewSimInstance());
            closeModal();
        }
    }

    get showAllSims(): boolean {
        return this._showAllSims;
    }

    set showAllSims(showAll: boolean) {
        this._showAllSims = showAll;
        this.table.data = showAll ? getRegisteredSimSpecs() : this.sheet.relevantSims;
    }
}

export class GraphicalSheetProvider extends SheetProvider<GearPlanSheetGui> {
    constructor() {
        super((...args) => new GearPlanSheetGui(...args));
    }

    fromExport(importedData: SheetExport): GearPlanSheetGui {
        const out = super.fromExport(importedData);
        out.setSelectFirstRowByDefault();
        return out;
    }

    fromSetExport(...importedData: SetExport[]): GearPlanSheetGui {
        const out = super.fromSetExport(...importedData);
        out.setSelectFirstRowByDefault();
        return out;
    }

    fromSaved(sheetKey: string): GearPlanSheetGui | null {
        const out = super.fromSaved(sheetKey);
        out?.setSelectFirstRowByDefault();
        return out;
    }
}

export const GRAPHICAL_SHEET_PROVIDER = new GraphicalSheetProvider();

customElements.define("gear-set-editor", GearSetEditor);
customElements.define("separator-editor", SeparatorEditor);
customElements.define("gear-set-viewer", GearSetViewer);
customElements.define("separator-viewer", SeparatorViewer);
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"});
customElements.define("gear-plan", GearPlanSheetElement);
customElements.define("sim-result-display", SimResultMiniDisplay);
customElements.define("sim-result-detail-display", SimResultDetailDisplay);
customElements.define("add-sim-dialog", AddSimDialog);
customElements.define("import-set-dialog", ImportSetsModal);
