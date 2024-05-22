import {
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelect,
    SingleSelectionModel
} from "./tables";
import {CharacterGearSet} from "./gear";
import {DataManager} from "./datamanager";
import {
    ChanceStat,
    ComputedSetStats,
    DisplayGearSlot,
    EquippedItem,
    EquipSlotKey,
    EquipSlots,
    FoodItem,
    GearItem,
    ItemDisplaySettings,
    ItemSlotExport,
    JobData,
    Materia,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    MeldableMateriaSlot,
    MultiplierStat,
    PartyBonusAmount,
    RawStatKey,
    SetExport,
    SetStatsExport,
    SheetExport,
    SheetStatsExport,
    SimExport,
    Substat
} from "@xivgear/xivmath/geartypes";
import {
    getDefaultSims,
    getRegisteredSimSpecs,
    getSimSpecByStub,
    SimCurrentResult,
    simpleAutoResultTable,
    SimResult,
    SimSettings,
    SimSpec,
    Simulation
} from "./simulation";
import {
    DefaultMateriaFillPrio,
    getClassJobStats,
    getDefaultDisplaySettings,
    getRaceStats,
    JobName,
    LEVEL_ITEMS,
    MAIN_STATS,
    MateriaSubstat,
    RACE_STATS,
    RaceName,
    STAT_ABBREVIATIONS,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {getCurrentHash, openSheetByKey, setTitle} from "./main";
import {getSetFromEtro} from "./external/etro_import";
import {Inactivitytimer} from "./util/inactivitytimer";
import {
    faIcon,
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundTextField,
    labeledCheckbox,
    makeActionButton,
    quickElement
} from "./components/util";
import {LoadingBlocker} from "./components/loader";
import {FoodItemsTable, FoodItemViewTable, GearItemsTable, GearItemsViewTable} from "./components/items";
import {GearEditToolbar} from "./components/gear_edit_toolbar";
import {camel2title} from "./util/strutils";
import {writeProxy} from "./util/proxies";
import {SetViewToolbar} from "./components/totals_display";
import {MateriaTotalsDisplay} from "./components/materia";
import {startRenameSet, startRenameSheet} from "./components/rename_dialog";
import {installDragHelper} from "./components/draghelpers";
import {getShortLink} from "./external/shortlink_server";
import {parseImport} from "./imports/imports";
import {startExport} from "./components/export_controller";
import {SETTINGS} from "./settings/persistent_settings";
import {BaseModal} from "./components/modal";
import {closeModal} from "./modalcontrol";
import {scrollIntoView} from "./util/scrollutil";
import {getBisSheet} from "./external/static_bis";
import {iconForIssues, SetIssuesModal} from "./components/gear_set_issues";
import {ImportSheetArea} from "./components/import_sheet";
import {SheetPickerTable} from "./components/saved_sheet_picker";
import {NewSheetForm} from "./components/new_sheet_form";
import {getNextSheetInternalName} from "./persistence/saved_sheets";

export const SHARED_SET_NAME = 'Imported Set';

export type GearSetSel = SingleCellRowOrHeaderSelect<CharacterGearSet>;

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
    rightSpan.textContent = (`(${(stats.chance * 100.0).toFixed(1)}%x${stats.multiplier.toFixed(3)})`)
    rightSpan.classList.add("extra-stat-info");
    outerDiv.appendChild(rightSpan);
    return outerDiv;
}

class SimResultData<ResultType extends SimResult> {
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

    private sheet: GearPlanSheet;

    constructor(sheet: GearPlanSheet, setSelection: (item: CharacterGearSet | Simulation<any, any, any> | SimResultData<any> | undefined) => void) {
        super();
        this.sheet = sheet;
        this.classList.add("gear-plan-table");
        this.classList.add("hoverable")
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
        const viewOnly = this.sheet.isViewOnly;
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
        const chanceStatColWidth = viewOnly ? 110 : 160;
        const multiStatColWidth = viewOnly ? 70 : 120;

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
                }
            }
        });

        const outer = this;

        this.columns = [
            {
                shortName: "actions",
                displayName: "",
                getter: gearSet => gearSet,
                renderer: gearSet => {
                    const div = document.createElement("div");
                    div.appendChild(makeActionButton([faIcon('fa-trash-can')], () => this.sheet.delGearSet(gearSet), 'Delete this set'));
                    div.appendChild(makeActionButton([faIcon('fa-copy')], () => this.sheet.cloneAndAddGearSet(gearSet, true), 'Clone this set'));
                    const dragger = document.createElement('button');
                    dragger.title = 'Drag to re-order this set'
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
                                    // @ts-ignore
                                    target = target.parentElement;
                                }
                            }
                            rowBeingDragged = null;
                        },
                        moveHandler: (ev) => {
                            // let target = ev.target;
                            const dragY = ev.clientY;
                            let target = this._rows.find(row => {
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
                    })
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
                        icon.classList.add('gear-set-issue-icon')
                        nameSpan.prepend(icon);
                        // elements.unshift(icon);
                        // div.appendChild(icon);
                        title += '\nThis set has problems:';
                        for (let issue of issues) {
                            title += `\n - ${issue.severity}: ${issue.description}`;
                        }
                    }
                    const div = document.createElement('div');
                    div.classList.add('set-name-desc-holder');
                    div.replaceChildren(...elements);
                    div.title = title;
                    return div;
                }
                // initialWidth: 300,
            },
            ...(viewOnly ? simColumns : []),
            {
                shortName: "gcd",
                displayName: "GCD",
                getter: gearSet => Math.min(gearSet.computedStats.gcdMag(2.5), gearSet.computedStats.gcdPhys(2.5)),
                renderer: gcd => document.createTextNode(gcd.toFixed(2)),
                initialWidth: statColWidth + 10,
            },
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
            } as CustomColumnSpec<CharacterGearSet, MultiplierStat>,
            {
                shortName: "hp",
                displayName: "HP",
                getter: gearSet => gearSet.computedStats.hp,
                extraClasses: ['stat-col', 'stat-col-hp'],
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
            },
            {
                shortName: "tenacity",
                displayName: "TNC",
                getter: gearSet => ({
                    stat: gearSet.computedStats.tenacity,
                    multiplier: gearSet.computedStats.tncMulti
                }) as MultiplierStat,
                renderer: multiplierStatDisplay,
                condition: () => this.sheet.isStatRelevant('tenacity'),
                extraClasses: ['stat-col', 'multiplier-stat-col'],
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
        for (let sim of this.dirtySimColColors) {
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
                if (cell) {
                    return [cell];
                }
            }
            return [];
        });
        let invalid = false;
        const processed: [CustomCell<any, any>, number][] = [];
        for (let cell of cells) {
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
            const worstValue = worst[1];
            const bestValue = best[1];
            const delta = bestValue - worstValue;
            if (delta === 0) {
                return;
            }
            for (let [cell, value] of processed) {
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

class SimResultDetailDisplay<X extends SimResult> extends HTMLElement {
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
                this.replaceChildren(simpleAutoResultTable(this._result.result));
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
            let slot = item.displayGearSlot;
            if (itemMapping.has(slot)) {
                itemMapping.get(slot).push(item);
            }
            else {
                itemMapping.set(slot, [item]);
            }
        })

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingLeft', 'RingRight'] as const;

        const weaponTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, this.sheet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon']);
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        this.gearTables = [weaponTable];

        for (let slot of leftSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot]);
            leftSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        for (let slot of rightSideSlots) {
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
            const linkUrl = new URL(`#/${hash.slice(1).join('/')}`, document.location.toString());
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
        for (let slot of EquipSlots) {
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
        for (let slot of leftSideSlots) {
            if (itemMapping.get(slot)) {
                const table = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, [slot]);
                leftSideDiv.appendChild(table);
                leftEnabled = true;
            }
        }
        for (let slot of rightSideSlots) {
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
    if (sheet.isViewOnly) {
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
    }
    const settingsProxy = new Proxy(originalSettings, settingsProxyHandler);
    const customInterface = sim.makeConfigInterface(settingsProxy, updateCallback);
    customInterface.id = 'sim-config-area-inner';
    customInterface.classList.add('sim-config-area-inner');
    outerDiv.appendChild(customInterface);

    return outerDiv;
}

export const defaultItemDisplaySettings: ItemDisplaySettings = {
    minILvl: 640,
    maxILvl: 999,
    minILvlFood: 610,
    maxILvlFood: 999,
    higherRelics: true
} as const;

/**
 * The top-level gear manager element
 */
export class GearPlanSheet extends HTMLElement {
    _sheetName: string;
    _description: string;
    readonly classJobName: JobName;
    readonly level: SupportedLevel;
    readonly ilvlSync: number | undefined;
    private _race: RaceName | undefined;
    private _partyBonus: PartyBonusAmount;
    private readonly _itemDisplaySettings: ItemDisplaySettings = {...defaultItemDisplaySettings};

    private _gearPlanTable: GearPlanTable;
    private readonly _saveKey: string | undefined;
    private _sets: CharacterGearSet[] = [];
    private _sims: Simulation<any, any, any>[] = [];
    private dataManager: DataManager;
    // private buttonRow: HTMLDivElement;
    private _relevantMateria: Materia[];
    private _relevantFood: FoodItem[];
    private readonly _importedData: SheetExport;
    private readonly _loadingScreen: LoadingBlocker;
    private _gearEditToolBar: GearEditToolbar;
    private _selectFirstRowByDefault: boolean = false;
    readonly headerArea: HTMLDivElement;
    readonly tableArea: HTMLDivElement;
    readonly tableHolder: HTMLDivElement;
    readonly buttonsArea: HTMLDivElement;
    readonly editorArea: HTMLDivElement;
    readonly midBarArea: HTMLDivElement;
    readonly toolbarHolder: HTMLDivElement;
    // TODO: SimResult alone might not be enough since we'd want it to refresh automatically if settings are changed
    private _editorItem: CharacterGearSet | Simulation<any, any, any> | SimResultData<SimResult> | undefined;
    private materiaAutoFillPrio: MateriaAutoFillPrio;
    private materiaAutoFillSelectedItems: boolean;
    private _materiaAutoFillController: MateriaAutoFillController;
    private readonly saveTimer: Inactivitytimer;
    private setupDone: boolean = false;
    isViewOnly: boolean = false;
    private gearUpdateTimer: Inactivitytimer;
    private _showAdvancedStats: boolean;
    isEmbed: boolean;


    /**
     * Try to load a sheet by its save key
     *
     * @param sheetKey The key to load
     * @returns The sheet if found, otherwise null
     */
    static fromSaved(sheetKey: string): GearPlanSheet | null {
        const exported = GearPlanSheet.loadSaved(sheetKey);
        return exported ? new GearPlanSheet(sheetKey, exported) : null;
    }

    static fromScratch(sheetKey: string, sheetName: string, classJob: JobName, level: SupportedLevel, ilvlSync: number | undefined): GearPlanSheet {
        const fakeExport: SheetExport = {
            job: classJob,
            level: level,
            name: sheetName,
            partyBonus: 0,
            race: undefined,
            saveKey: sheetKey,
            sets: [{
                name: "Default Set",
                items: {}
            }],
            sims: [],
            ilvlSync: ilvlSync
            // ctor will auto-fill the rest
        }
        const gearPlanSheet = new GearPlanSheet(sheetKey, fakeExport);
        gearPlanSheet.addDefaultSims();
        gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    static fromExport(importedData: SheetExport): GearPlanSheet {
        return new GearPlanSheet(undefined, importedData);
    }

    static fromSetExport(importedData: SetExport): GearPlanSheet {
        const gearPlanSheet = this.fromExport({
            race: undefined,
            sets: [importedData],
            sims: importedData.sims ?? [],
            name: SHARED_SET_NAME,
            saveKey: undefined,
            job: importedData.job,
            level: importedData.level,
            ilvlSync: importedData.ilvlSync,
            partyBonus: 0,
            itemDisplaySettings: defaultItemDisplaySettings,
        });
        if (importedData.sims === undefined) {
            gearPlanSheet.addDefaultSims();
        }
        gearPlanSheet._selectFirstRowByDefault = true;
        return gearPlanSheet;
    }

    private static loadSaved(sheetKey: string): SheetExport | null {
        const item = localStorage.getItem(sheetKey);
        if (item) {
            return JSON.parse(item) as SheetExport;
        }
        else {
            return null;
        }
    }

    // Can't make ctor private for custom element, but DO NOT call this directly - use fromSaved or fromScratch
    constructor(sheetKey: string, importedData: SheetExport) {
        super();
        console.log(importedData);
        this.classList.add('gear-sheet');
        this.classList.add('loading');
        this._importedData = importedData;
        this._saveKey = sheetKey;
        this.headerArea = document.createElement('div');
        this.headerArea.classList.add('header-area');
        this.tableArea = document.createElement("div");
        this.tableArea.classList.add('gear-sheet-table-area', 'hide-when-loading');
        this.tableHolder = document.createElement('div');
        this.tableHolder.classList.add('gear-sheet-table-holder');
        const tableHolderOuter = document.createElement('div');
        tableHolderOuter.classList.add('gear-sheet-table-holder-outer')
        tableHolderOuter.appendChild(this.tableHolder);
        this.tableArea.appendChild(tableHolderOuter);
        this.buttonsArea = document.createElement("div");
        this.buttonsArea.classList.add('gear-sheet-buttons-area', 'hide-when-loading', 'show-hide-parent');
        this.editorArea = document.createElement("div");
        this.editorArea.classList.add('gear-sheet-editor-area', 'hide-when-loading');
        this.midBarArea = document.createElement("div");
        this.midBarArea.classList.add('gear-sheet-midbar-area', 'hide-when-loading');
        this.toolbarHolder = document.createElement('div');
        this.toolbarHolder.classList.add('gear-sheet-toolbar-holder', 'hide-when-loading');
        this.appendChild(this.headerArea);
        this.appendChild(this.tableArea);
        this.appendChild(this.midBarArea);
        this.appendChild(this.editorArea);
        this.midBarArea.append(this.toolbarHolder);

        const flexPadding = quickElement('div', ['flex-padding-item'], []);
        this.appendChild(flexPadding);

        this._sheetName = importedData.name;
        this.level = importedData.level ?? 90;
        this._race = importedData.race;
        this._partyBonus = importedData.partyBonus ?? 0;
        this.classJobName = importedData.job ?? 'WHM';
        this.ilvlSync = importedData.ilvlSync;
        this._description = importedData.description;
        if (importedData.itemDisplaySettings) {
            Object.assign(this._itemDisplaySettings, importedData.itemDisplaySettings);
        }
        else {
            const defaults = getDefaultDisplaySettings(this.level, this.classJobName);
            Object.assign(this._itemDisplaySettings, defaults);
            // TODO: investigate if this logic is worth doing
            // if (this.ilvlSync) {
            //     const modifiedDefaults = {...defaults};
            //     modifiedDefaults.minILvl = Math.max(modifiedDefaults.minILvl, this.ilvlSync - 10);
            //     modifiedDefaults.maxILvl = Math.max(modifiedDefaults.maxILvl, this.ilvlSync + 40);
            // }
            // else {
            // }
        }
        this.materiaAutoFillPrio = {
            statPrio: importedData.mfp ?? [...DefaultMateriaFillPrio.filter(stat => this.isStatRelevant(stat))],
            // Just picking a bogus value so the user understands what it is
            minGcd: importedData.mfMinGcd ?? 2.05
        };
        this.materiaAutoFillSelectedItems = importedData.mfni ?? false;

        // Early gui setup
        this._loadingScreen = new LoadingBlocker();
        this.saveTimer = new Inactivitytimer(1_000, () => this.saveData());
        this.appendChild(this._loadingScreen);
        this.setupEditorArea();
    }

    get showAdvancedStats() {
        return this._showAdvancedStats;
    }

    set showAdvancedStats(show: boolean) {
        this._showAdvancedStats = show;
        SETTINGS.viewDetailedStats = show;
        if (show) {
            this._gearPlanTable.classList.add('show-advanced-stats');
        }
        else {
            this._gearPlanTable.classList.remove('show-advanced-stats');
        }
    }

    setViewOnly() {
        this.isViewOnly = true;
        this.classList.add("view-only");
    }

    private set editorItem(item: typeof this._editorItem) {
        this._editorItem = item;
        if (this.isViewOnly) {
            this.headerArea.style.display = 'none';
        }
        this.resetEditorArea();
    }

    private resetEditorArea() {
        const item = this._editorItem;
        try {
            if (!item) {
                this.setupEditorArea();
            }
            else if (item instanceof CharacterGearSet) {
                if (this.isViewOnly) {
                    this.setupEditorArea(new GearSetViewer(this, item));
                }
                else {
                    this.setupEditorArea(new GearSetEditor(this, item));
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

        if (!this.isViewOnly) {
            const addRowButton = makeActionButton("New Gear Set", () => {
                const newSet = new CharacterGearSet(this);
                newSet.name = "New Set";
                this.addGearSet(newSet, true);
            })
            buttonsArea.appendChild(addRowButton)
            const renameButton = makeActionButton("Sheet Name/Description", () => {
                startRenameSheet(this);
            });
            buttonsArea.appendChild(renameButton);
        }

        if (this.ilvlSync != undefined) {
            const span = quickElement('span', [], [document.createTextNode(`ilvl Sync: ${this.ilvlSync}`)]);
            const ilvlSyncLabel = quickElement('div', ['like-a-button'], [span]);
            // TODO: think about how to allow creating a new sheet with different ilvl
            // ilvlSyncLabel.title = 'To change the item level sync, click the "Save As" button and create a '
            buttonsArea.appendChild(ilvlSyncLabel);
        }

        const saveAsButton = makeActionButton("Save As", () => {
            const defaultName = this.sheetName === SHARED_SET_NAME ? 'Imported Set' : this.sheetName + ' copy';
            const newName = prompt("Enter a name for the new sheet: ", defaultName);
            if (newName === null) {
                return;
            }
            console.log('New name', newName);
            const newSaveKey = this.saveAs(newName);
            // TODO: should this be provided as a ctor arg instead?
            openSheetByKey(newSaveKey);
        });
        buttonsArea.appendChild(saveAsButton)

        if (!this.isViewOnly) {

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
            [0, 1, 2, 3, 4, 5]
        )
        buttonsArea.appendChild(partySizeDropdown);

        if (this._saveKey) {
            this.headerArea.style.display = 'none';
        }
        else {
            if (this.isViewOnly) {
                const heading = document.createElement('h1');
                heading.textContent = this.sheetName;
                this.headerArea.appendChild(heading);

                const trimmedDesc = this._description?.trim();
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
                unsavedWarning.textContent = 'This imported sheet will not be saved unless you use the "Save As" button below.'
                this.headerArea.appendChild(unsavedWarning);
            }
            this.headerArea.style.display = '';
            const headerButton = makeActionButton('Toggle Header', () => {
                // TODO: if you have manually shown the header, don't hide it again when re-selecting a set
                this.headerArea.style.display = (this.headerArea.style.display === 'none') ? '' : 'none';
            })
            buttonsArea.appendChild(headerButton);
            const advancedStats = makeActionButton('Toggle Details', () => {
                this.showAdvancedStats = !this.showAdvancedStats;
            })
            buttonsArea.appendChild(advancedStats);
        }
        // const tableAreaInner = quickElement('div', ['gear-sheet-table-area-inner'], [this._gearPlanTable, this.buttonsArea]);
        this.tableHolder.appendChild(this._gearPlanTable);
        this.tableHolder.appendChild(buttonsArea);
        try {
            const ro = new ResizeObserver(() => {
                this.fixScroll();
            });
            ro.observe(this);
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
        this.classList.remove('loading');
        // console.log(`${this._selectFirstRowByDefault} ${this.sets.length}`);


        const outer = this;
        const matFillCtrl: MateriaAutoFillController = {

            get autoFillNewItem() {
                return outer.materiaAutoFillSelectedItems;
            },
            set autoFillNewItem(enabled: boolean) {
                outer.materiaAutoFillSelectedItems = enabled;
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
            }
            const after = (ev: MouseEvent) => {
                document.removeEventListener('pointermove', eventListener);
                document.removeEventListener('pointerup', after);
            }
            document.addEventListener('pointermove', eventListener);
            document.addEventListener('pointerup', after);
        });

        if (this._selectFirstRowByDefault && this.sets.length >= 1) {
            this._gearPlanTable.selectGearSet(this.sets[0])
        }

        this.setupDone = true;
    }

    async loadDataOnly() {
        console.log("Loading sheet...");
        console.log("Reading data");
        const saved = this._importedData;
        const lvlItemInfo = LEVEL_ITEMS[this.level];
        this.dataManager = new DataManager(this.classJobName, this.level, this.ilvlSync);
        await this.dataManager.loadData();
        for (let importedSet of saved.sets) {
            this.addGearSet(this.importGearSet(importedSet));
        }
        if (saved.sims) {
            for (let simport of saved.sims) {
                const simSpec = getSimSpecByStub(simport.stub);
                if (simSpec === undefined) {
                    console.error("Sim no longer present: " + simport.stub);
                    continue;
                }
                try {
                    const rehydratedSim: Simulation<any, any, any> = simSpec.loadSavedSimInstance(simport.settings);
                    if (simport.name) {
                        rehydratedSim.displayName = simport.name;
                    }
                    if (rehydratedSim.settings.includeInExport === undefined) {
                        rehydratedSim.settings.includeInExport = true;
                    }
                    this.addSim(rehydratedSim);
                }
                catch (e) {
                    console.error("Error loading sim settings", e);
                }
            }
        }
        this._relevantMateria = this.dataManager.allMateria.filter(mat => {
            return mat.materiaGrade <= lvlItemInfo.maxMateria
                && mat.materiaGrade >= lvlItemInfo.minMateria
                && this.isStatRelevant(mat.primaryStat);
        });
        this._relevantFood = this.dataManager.allFoodItems.filter(food => this.isStatRelevant(food.primarySubStat) || this.isStatRelevant(food.secondarySubStat));

    }

    async loadFully() {
        await this.loadDataOnly();
        this.setupRealGui();
    }

    saveData() {
        if (!this.setupDone) {
            // Don't clobber a save with empty data because the sheet hasn't loaded!
            return;
        }
        if (this._saveKey) {
            console.log("Saving sheet " + this.sheetName);
            const fullExport = this.exportSheet(false);
            localStorage.setItem(this._saveKey, JSON.stringify(fullExport));
        }
        else {
            console.info("Ignoring request to save sheet because it has no save key");
        }
    }

    requestSave() {
        this.saveTimer.ping();
    }

    get sheetName() {
        return this._sheetName;
    }

    set sheetName(name) {
        this._sheetName = name;
        setTitle(this._sheetName);
        this.requestSave();
    }

    get description() {
        return this._description;
    }

    set description(desc) {
        this._description = desc;
        this.requestSave();
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

    /**
     * Copy this sheet to a new save slot.
     *
     * @param name
     * @returns The saveKey of the new sheet.
     */
    saveAs(name: string): string {
        const exported = this.exportSheet(true);
        exported.name = name;
        const newKey = getNextSheetInternalName();
        localStorage.setItem(newKey, JSON.stringify(exported));
        return newKey;
    }

    exportSims(external: boolean): SimExport[] {
        return this._sims.filter(sim => !external || sim.settings.includeInExport).map(sim =>
            ({
                stub: sim.spec.stub,
                settings: sim.exportSettings(),
                name: sim.displayName
            }));
    }

    exportSheet(): SheetExport;
    exportSheet(external: boolean): SheetExport;
    exportSheet(external: boolean, fullStats: false): SheetExport;
    exportSheet(external: boolean, fullStats: true): SheetStatsExport;

    exportSheet(external: boolean = false, fullStats: boolean = false): SheetExport | SheetStatsExport {
        // TODO: make this async
        const sets = this._sets.map(set => {
            const rawExport = this.exportGearSet(set, false);
            if (fullStats) {
                const augGs: SetStatsExport = {
                    ...rawExport,
                    computedStats: set.computedStats
                }
                return augGs;
            }
            return rawExport;
        });
        let simsExport: SimExport[] = this.exportSims(external);
        const out: SheetExport = {
            name: this.sheetName,
            sets: sets,
            level: this.level,
            job: this.classJobName,
            partyBonus: this._partyBonus,
            race: this._race,
            sims: simsExport,
            itemDisplaySettings: this._itemDisplaySettings,
            mfni: this.materiaAutoFillSelectedItems,
            mfp: this.materiaAutoFillPrio.statPrio,
            mfMinGcd: this.materiaAutoFillPrio.minGcd,
            ilvlSync: this.ilvlSync,
            description: this.description
        };
        if (!external) {
            out.saveKey = this._saveKey;
        }
        return out;

    }

    addGearSet(gearSet: CharacterGearSet, select: boolean = false) {
        this._sets.push(gearSet);
        if (this._gearPlanTable) {
            this._gearPlanTable.dataChanged();
        }
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
        this.saveData();
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
        this._sets = this._sets.filter(gs => gs !== gearSet);
        if (this._gearPlanTable) {
            this._gearPlanTable.dataChanged();
            this._gearPlanTable.reprocessAllSimColColors();
        }
        this.saveData();
    }

    reorderSet(gearSet: CharacterGearSet, to: number) {
        const sets = [...this._sets];
        const from = sets.indexOf(gearSet);
        if (from === to) {
            return;
        }
        if (from < 0 || to < 0) {
            return;
        }
        const removed = sets.splice(from, 1)[0];
        sets.splice(to, 0, removed);
        this._sets = sets;

        this._gearPlanTable.dataChanged();
    }

    addSim(sim: Simulation<any, any, any>) {
        this._sims.push(sim);
        if (this._gearPlanTable) {
            this.gearPlanTable.simsChanged();
        }
        this.saveData();
    }

    delSim(sim: Simulation<any, any, any>) {
        this._sims = this._sims.filter(s => s !== sim);
        if (this._gearPlanTable) {
            this.gearPlanTable.simsChanged();
        }
        this.saveData();
    }

    cloneAndAddGearSet(gearSet: CharacterGearSet, select: boolean) {
        const cloned = this.importGearSet(this.exportGearSet(gearSet));
        cloned.name = cloned.name + ' copy';
        this.addGearSet(cloned, select);
    }

    /**
     * Export a CharacterGearSet to a SetExport so that it can safely be serialized for saving or sharing.
     *
     * @param set The set to export.
     * @param external true to include fields which are useful for exporting but not saving (e.g. including job name
     * for single set exports).
     */
    exportGearSet(set: CharacterGearSet, external: boolean = false): SetExport {
        const items: { [K in EquipSlotKey]?: ItemSlotExport } = {};
        for (let equipmentKey in set.equipment) {
            const inSlot: EquippedItem = set.equipment[equipmentKey];
            if (inSlot) {
                const exportedItem: ItemSlotExport = {
                    // TODO: determine if it makes more sense to just serialize empty materia slots as {}
                    // The advantage is that {} is a lot smaller than {"id":-1}, and exports are already long
                    // On the other hand, *most* real exports would have slots filled (BiS etc)
                    id: inSlot.gearItem.id,
                    materia: inSlot.melds.map(meld => {
                        return {id: meld.equippedMateria?.id ?? -1}
                    }),
                };
                if (inSlot.relicStats && Object.entries(inSlot.relicStats)) {
                    exportedItem.relicStats = {...inSlot.relicStats};
                }
                items[equipmentKey] = exportedItem;
            }
        }
        const out: SetExport = {
            name: set.name,
            items: items,
            food: set.food ? set.food.id : undefined,
            description: set.description
        };
        if (external) {
            out.job = this.classJobName;
            out.level = this.level;
            out.ilvlSync = this.ilvlSync;
            out.sims = this.exportSims(true);
        }
        else {
            if (set.relicStatMemory) {
                out.relicStatMemory = set.relicStatMemory.export();
            }
        }
        return out;
    }

    /**
     * Convert a SetExport back to a CharacterGearSet.
     *
     * This does not add the set to the sheet or do anything other than conversion.
     *
     * @param importedSet
     */
    importGearSet(importedSet: SetExport): CharacterGearSet {
        const set = new CharacterGearSet(this);
        set.name = importedSet.name;
        set.description = importedSet.description;
        for (let equipmentSlot in importedSet.items) {
            const importedItem: ItemSlotExport = importedSet.items[equipmentSlot];
            if (!importedItem) {
                continue;
            }
            const baseItem = this.dataManager.itemById(importedItem.id);
            if (!baseItem) {
                continue;
            }
            const equipped = new EquippedItem(baseItem);
            for (let i = 0; i < Math.min(equipped.melds.length, importedItem.materia.length); i++) {
                const id = importedItem.materia[i].id;
                const mat = this.dataManager.materiaById(id);
                if (!mat) {
                    continue;
                }
                equipped.melds[i].equippedMateria = mat;
            }
            if (importedItem.relicStats && equipped.gearItem.isCustomRelic) {
                Object.assign(equipped.relicStats, importedItem.relicStats);
            }
            set.equipment[equipmentSlot] = equipped;
        }
        if (importedSet.food) {
            set.food = this.dataManager.foodById(importedSet.food);
        }
        if (importedSet.relicStatMemory) {
            set.relicStatMemory.import(importedSet.relicStatMemory);
        }
        return set;
    }

    // TODO: this needs to only update when we have updated that specific gear set, not any random gear set.
    // If this gear set was not updated, then a cached result should be returned.
    getSimResult(simulation: Simulation<any, any, any>, set: CharacterGearSet): SimCurrentResult<SimResult> {
        const simPromise = simulation.simulate(set);
        const out: SimCurrentResult<any> = {
            result: undefined,
            resultPromise: undefined,
            status: 'Running',
            error: undefined
        };
        out.resultPromise = new Promise((resolve, reject) => {
            simPromise.then(result => {
                out.status = 'Done';
                out.result = result;
                resolve(out);
            }, error => {
                out.status = 'Error';
                out.error = error;
                console.error("Sim Error!", error);
                reject(error);
            });
        });
        return out;
    }

    showAddSimDialog() {
        const addSimDialog = new AddSimDialog(this);
        document.querySelector('body').appendChild(addSimDialog);
        addSimDialog.show();
    }

    recalcAll() {
        for (let set of this._sets) {
            set.forceRecalc();
        }
    }

    get saveKey() {
        return this._saveKey;
    }

    get classJobStats() {
        return this.statsForJob(this.classJobName);
    }

    private get classJobEarlyStats() {
        return getClassJobStats(this.classJobName);
    }

    statsForJob(job: JobName): JobData {
        return {
            ...getClassJobStats(job),
            jobStatMultipliers: this.dataManager.multipliersForJob(job)
        };
    }

    isStatRelevant(stat: RawStatKey) {
        if (!this.classJobEarlyStats) {
            // Not sure what the best way to handle this is
            return true;
        }
        if (MAIN_STATS.includes(stat as typeof MAIN_STATS[number])) {
            return (stat === this.classJobEarlyStats.mainStat);
        }
        if (this.classJobEarlyStats.irrelevantSubstats) {
            return !this.classJobEarlyStats.irrelevantSubstats.includes(stat as Substat);
        }
        else {
            return true;
        }
    }

    get relevantSims() {
        return getRegisteredSimSpecs().filter(simSpec => simSpec.supportedJobs === undefined ? true : simSpec.supportedJobs.includes(this.dataManager.classJob));
    }

    get raceStats() {
        return getRaceStats(this._race);
    }

    get race() {
        return this._race;
    }

    set race(race) {
        this._race = race;
        this.recalcAll();
    }

    get gearPlanTable(): GearPlanTable {
        return this._gearPlanTable;
    }

    get sets(): CharacterGearSet[] {
        return this._sets;
    }

    get sims(): Simulation<any, any, any>[] {
        return this._sims;
    }

    get relevantFood(): FoodItem[] {
        return this._relevantFood;
    }

    get relevantMateria(): Materia[] {
        return this._relevantMateria;
    }

    get partyBonus(): PartyBonusAmount {
        return this._partyBonus;
    }

    set partyBonus(partyBonus: PartyBonusAmount) {
        this._partyBonus = partyBonus;
        this.recalcAll();
    }

    get itemsForDisplay(): GearItem[] {
        return this.dataManager.allItems.filter(item => {
            return item.ilvl >= this._itemDisplaySettings.minILvl
                && (item.ilvl <= this._itemDisplaySettings.maxILvl
                    || item.isCustomRelic && this._itemDisplaySettings.higherRelics);
        });
    }

    get itemDisplaySettings(): ItemDisplaySettings {
        return writeProxy(this._itemDisplaySettings, () => this.gearUpdateTimer.ping());
    }

    get foodItemsForDisplay(): FoodItem[] {
        return this._relevantFood.filter(item => item.ilvl >= this._itemDisplaySettings.minILvlFood && item.ilvl <= this._itemDisplaySettings.maxILvlFood);
    }

    getBestMateria(stat: MateriaSubstat, meldSlot: MeldableMateriaSlot) {
        const highGradeAllowed = meldSlot.materiaSlot.allowsHighGrade;
        const maxGradeAllowed = meldSlot.materiaSlot.maxGrade;
        const materiaFilter = (materia: Materia) => {
            if (materia.isHighGrade && !highGradeAllowed) {
                return false;
            }
            return materia.materiaGrade <= maxGradeAllowed && materia.primaryStat == stat;
        };
        const sortedOptions = this.relevantMateria.filter(materiaFilter).sort((first, second) => second.primaryStatValue - first.primaryStatValue);
        return sortedOptions.length >= 1 ? sortedOptions[0] : undefined;
    }

    addDefaultSims() {
        const sims = getDefaultSims(this.classJobName, this.level);
        for (let simSpec of sims) {
            try {
                this.addSim(simSpec.makeNewSimInstance());
            }
            catch (e) {
                console.error(`Error adding default sim ${simSpec.displayName} (${simSpec.stub})`, e);
            }
        }
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
}

class ImportSetsModal extends BaseModal {
    private readonly loader: LoadingBlocker;
    private readonly importButton: HTMLButtonElement;
    private readonly textArea: HTMLTextAreaElement;

    constructor(private sheet: GearPlanSheet) {
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

    checkJob(importedJob: JobName, plural: boolean): boolean {
        if (importedJob !== this.sheet.classJobName) {
            // TODO: *try* to import some sims, or at least load up the defaults.
            let msg;
            if (plural) {
                msg = `You are trying to import ${importedJob} set(s) into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            else {
                msg = `You are trying to import a ${importedJob} set into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
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
                    getSetFromEtro(parsed.rawUuid).then(set => {
                        if (!this.checkJob(set.job, false)) {
                            this.ready = true;
                            return;
                        }
                        this.sheet.addGearSet(this.sheet.importGearSet(set), true);
                        console.log("Loaded set from Etro");
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
            if (!this.checkJob(rawImport.job, true)) {
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
            if (!this.checkJob(rawImport.job, false)) {
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


class AddSimDialog extends BaseModal {
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
        ]
        this.table.data = this.sheet.relevantSims;
        const showAllCb = labeledCheckbox('Show sims for other jobs', new FieldBoundCheckBox<AddSimDialog>(this, 'showAllSims'));
        form.appendChild(showAllCb);
        form.appendChild(this.table);

        const descriptionArea = document.createElement('div');
        descriptionArea.classList.add('add-sim-description');
        descriptionArea.textContent = 'Select a simulation to see a description';
        form.append(descriptionArea);

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



export interface XivApiJobData {
    Name: string,
    Abbreviation: string,
    ID: number,
    Icon: string
}

customElements.define("gear-set-editor", GearSetEditor);
customElements.define("gear-set-viewer", GearSetViewer);
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"});
customElements.define("gear-plan", GearPlanSheet);
customElements.define("gear-sheet-picker", SheetPickerTable, {extends: "table"});
customElements.define("new-sheet-form", NewSheetForm, {extends: "form"});
customElements.define("sim-result-display", SimResultMiniDisplay);
customElements.define("sim-result-detail-display", SimResultDetailDisplay);
customElements.define("add-sim-dialog", AddSimDialog);
customElements.define("import-set-dialog", ImportSetsModal);
customElements.define("import-sheet-area", ImportSheetArea);
