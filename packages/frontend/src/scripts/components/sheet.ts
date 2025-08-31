/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: get back to fixing this at some point
import {camel2title, capitalizeFirstLetter, toRelPct} from "@xivgear/util/strutils";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {
    col,
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelectionModel,
    SingleRowSelectionModel,
    TableSelectionModel
} from "@xivgear/common-ui/table/tables";
import {GearPlanSheet, SheetProvider} from "@xivgear/core/sheet";
import {
    DataSelect,
    faIcon,
    FieldBoundCheckBox,
    FieldBoundDataSelect,
    FieldBoundTextField,
    labeledCheckbox,
    makeActionButton,
    quickElement
} from "@xivgear/common-ui/components/util";
import {
    ChanceStat,
    ComputedSetStats,
    DisplayGearSlot,
    EquipSlotKey,
    EquipSlots,
    GearItem,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    MateriaFillMode,
    MultiplierMitStat,
    MultiplierStat,
    PartyBonusAmount,
    RawStatKey,
    SetExport,
    SheetExport
} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet, SyncInfo} from "@xivgear/core/gear";
import {
    getClassJobStats,
    JobName,
    MAX_PARTY_BONUS,
    RACE_STATS,
    RaceName,
    STAT_ABBREVIATIONS,
    SupportedLevel,
    JOB_DATA
} from "@xivgear/xivmath/xivconstants";
import {getCurrentHash, getCurrentState, processNav} from "../nav_hash";
import {MateriaTotalsDisplay} from "./materia";
import {FoodItemsTable, FoodItemViewTable, GearItemsTable, GearItemsViewTable} from "./items";
import {SetViewToolbar} from "./totals_display";
import {scrollIntoView} from "@xivgear/common-ui/util/scrollutil";
import {installDragHelper} from "./draghelpers";
import {iconForIssues, SetIssuesModal} from "./gear_set_issues";
import {Inactivitytimer} from "@xivgear/util/inactivitytimer";
import {startExport} from "./export_controller";
import {startRenameSet, startRenameSheet} from "./rename_dialog";
import {writeProxy} from "@xivgear/util/proxies";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {GearEditToolbar} from "./gear_edit_toolbar";
import {openSheetByKey, setTitle} from "../base_ui";
import {parseImport} from "@xivgear/core/imports/imports";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {getSetFromEtro} from "@xivgear/core/external/etro_import";
import {getBisSheet} from "@xivgear/core/external/static_bis";
import {simpleKvTable} from "../sims/components/simple_tables";
import {rangeInc} from "@xivgear/util/array_utils";
import {SimCurrentResult, SimResult, SimSettings, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";
import {getRegisteredSimSpecs} from "@xivgear/core/sims/sim_registry";
import {makeUrl, NavState, ONLY_SET_QUERY_PARAM} from "@xivgear/core/nav/common_nav";
import {simMaintainersInfoElement} from "./sims";
import {SaveAsModal, BaseSheetSettingsModal} from "./new_sheet_form";
import {DropdownActionMenu} from "./dropdown_actions_menu";
import {CustomFoodPopup, CustomItemPopup} from "./custom_item_manager";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {SimulationGui} from "../sims/simulation_gui";
import {makeGui} from "../sims/sim_guis";
import {recordSheetEvent} from "@xivgear/gearplan-frontend/analytics/analytics";
import {MeldSolverDialog} from "./meld_solver_modal";
import {insertAds} from "./ads";
import {SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";
import {isInIframe} from "@xivgear/common-ui/util/detect_iframe";
import {recordError, recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {ExpandableText} from "@xivgear/common-ui/components/expandy_text";
import {SheetInfoModal} from "./sheet_info_modal";
import {FramelessJobIcon, JobIcon} from "./job_icon";
import {setDataManagerErrorReporter} from "@xivgear/core/data_api_client";
import {SpecialStatType} from "@xivgear/data-api-client/dataapi";
import {SHEET_MANAGER} from "./saved_sheet_impl";

const noSeparators = (set: CharacterGearSet) => !set.isSeparator;

const isSafari: boolean = (() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('safari') && !ua.includes('chrome');
})();

// Set up error reporting for DataManager
setDataManagerErrorReporter((response, params) => {
    recordError("datamanagerfetch", `fetch error: ${response.status}: ${response.statusText} (${params[0]})`, {
        fetchUrl: params[0],
        statusCode: response.status,
        statusText: response.statusText,
    });
});

function mainStatCol(sheet: GearPlanSheet, stat: RawStatKey): CustomColumnSpec<CharacterGearSet, MultiplierStat> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: gearSet => ({
            stat: gearSet.computedStats[stat],
            multiplier: gearSet.computedStats.mainStatMulti,
        }),
        condition: () => sheet.isStatRelevant(stat),
        renderer: multiplierStatTooltip,
        extraClasses: ['stat-col', 'main-stat-col', 'stat-col-less-important'],
        rowCondition: noSeparators,
    };
}

function tooltipMultiStatCol(sheet: GearPlanSheet, stat: RawStatKey, multiKey: { [K in keyof ComputedSetStats]: ComputedSetStats[K] extends number ? K : never }[keyof ComputedSetStats]): CustomColumnSpec<CharacterGearSet, MultiplierStat> {
    return {
        shortName: stat,
        displayName: STAT_ABBREVIATIONS[stat],
        getter: gearSet => ({
            stat: gearSet.computedStats[stat],
            multiplier: gearSet.computedStats[multiKey],
        }),
        condition: () => sheet.isStatRelevant(stat),
        renderer: multiplierStatTooltip,
        extraClasses: ['stat-col', 'compact-multiplier-stat-col', 'stat-col-less-important'],
        rowCondition: noSeparators,
    };
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
        public readonly simInst: SimulationGui<ResultType, any, any>,
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
export class GearPlanTable extends CustomTable<CharacterGearSet, SingleCellRowOrHeaderSelectionModel<CharacterGearSet, SimCurrentResult, SimulationGui<any, any, any>>> {

    private readonly sheet: GearPlanSheetGui;

    constructor(sheet: GearPlanSheetGui, setSelection: (item: CharacterGearSet | SimulationGui<any, any, any> | SimResultData<any> | null) => void) {
        super();
        this.sheet = sheet;
        this.classList.add("gear-plan-table");
        this.classList.add("hoverable");
        this.setupColumns();
        const selModel = new SingleCellRowOrHeaderSelectionModel<CharacterGearSet, SimCurrentResult, SimulationGui<any, any, any>>();
        // const selModel = new SingleSelectionModel();
        this.selectionModel = selModel;
        selModel.addListener({
            onNewSelection(newSelection) {
                if (newSelection instanceof CustomRow) {
                    setSelection(newSelection.dataItem);
                }
                else if (newSelection instanceof CustomColumn && newSelection.dataValue['makeConfigInterface']) {
                    setSelection(newSelection.dataValue as SimulationGui<any, any, any>);
                }
                else if (newSelection instanceof CustomCell && newSelection.colDef.dataValue?.sim.spec) {
                    setSelection(new SimResultData(newSelection.colDef.dataValue, newSelection.cellValue));
                }
                else if (newSelection === undefined) {
                    setSelection(undefined);
                }
            },
        });
    }

    get simGuis(): SimulationGui<any, any, any>[] {
        return this.sheet.simGuis;
    }

    get gearSets(): CharacterGearSet[] {
        return this.sheet.sets;
    }

    selectGearSet(set: CharacterGearSet | undefined) {
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
            if ('simulate' in selectedItem && !this.simGuis.includes(selectedItem)) {
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
        // const chanceStatColWidth = viewOnly ? 110 : 160;
        // const multiStatColWidth = viewOnly ? 70 : 120;

        const jobData = getClassJobStats(this.sheet.classJobName);

        const gcdColumns: CustomColumnSpec<CharacterGearSet, any>[] = [];
        const override = jobData.gcdDisplayOverrides?.(this.sheet.level);
        if (override) {
            let counter = 0;
            for (const gcdOver of override) {
                gcdColumns.push(col({
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
                }));
            }
        }
        else {
            gcdColumns.push(
                col({
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
                }));
        }

        const simColumns: CustomColumnSpec<CharacterGearSet, SimCurrentResult, SimulationGui<any, any, any>>[] = this.simGuis.map(simGui => {
            return ({
                dataValue: simGui,
                shortName: "sim-col-" + simGui.sim.shortName,
                get displayName() {
                    return simGui.sim.displayName;
                },
                getter: gearSet => this.sheet.getSimResult(simGui.sim, gearSet),
                renderer: result => new SimResultMiniDisplay(this, simGui, result),
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
            });
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
                                else if (target instanceof Node) {
                                    target = target["parentElement"] as EventTarget;
                                }
                                else {
                                    break;
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
                        },
                    });
                    div.appendChild(dragger);
                    return div;
                },
            },
            {
                shortName: "setname",
                displayName: "Set Name",
                getter: (gearSet => gearSet),
                renderer: (value: CharacterGearSet) => {
                    const nameSpan = document.createElement('span');
                    const elements: Element[] = [nameSpan];
                    if (value.name.trim().length === 0
                        && (value.description === undefined || value.description.trim().length === 0)) {
                        // If length is zero, insert an NBSP so that the row doesn't collapse to 0 pixels when viewing
                        // a separator with an empty title+desc.
                        nameSpan.textContent = '\xa0';
                    }
                    else {
                        nameSpan.textContent = value.name;
                    }
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
                        title += '\nThis set has problems:';
                        for (const issue of issues) {
                            let titlePart = `${capitalizeFirstLetter(issue.severity)}: ${issue.description}`;
                            if (issue.affectedSlots) {
                                titlePart += ` (${issue.affectedSlots.join(', ')})`;
                            }
                            title += '\n - ' + titlePart;
                        }
                    }
                    if (!value.isSeparator && this.sheet.isMultiJob) {
                        const jobIcon = new FramelessJobIcon(value.job);
                        jobIcon.style.display = 'inline';
                        nameSpan.prepend(jobIcon);
                    }
                    const div = document.createElement('div');
                    div.classList.add('set-name-desc-holder');
                    div.replaceChildren(...elements);
                    div.title = title;
                    if (value.isSeparator) {
                        nameSpan.style.fontWeight = 'bold';
                    }
                    return div;
                },
            },
            ...simColumns,
            ...gcdColumns,
            {
                shortName: "wd",
                displayName: "WD",
                getter: gearSet => ({
                    stat: Math.max(gearSet.computedStats.wdMag, gearSet.computedStats.wdPhys),
                    multiplier: gearSet.computedStats.wdMulti,
                }),
                initialWidth: statColWidth,
                renderer: multiplierStatTooltip,
                extraClasses: ['stat-col', 'stat-col-less-important'],
                rowCondition: noSeparators,
            } as CustomColumnSpec<CharacterGearSet, MultiplierStat>,
            {
                shortName: "hp",
                displayName: "HP",
                getter: gearSet => gearSet.computedStats.hp,
                extraClasses: ['stat-col', 'stat-col-hp', 'stat-col-less-important'],
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
                    multiplier: gearSet.computedStats.critMulti,
                }) as ChanceStat,
                renderer: chanceStatDisplay,
                condition: () => this.sheet.isStatRelevant('crit'),
                extraClasses: ['stat-col', 'chance-stat-col', 'stat-col-less-important'],
                rowCondition: noSeparators,
            },
            {
                shortName: "dhit",
                displayName: "DHT",
                getter: gearSet => ({
                    stat: gearSet.computedStats.dhit,
                    chance: gearSet.computedStats.dhitChance,
                    multiplier: gearSet.computedStats.dhitMulti,
                }) as ChanceStat,
                renderer: chanceStatDisplay,
                condition: () => this.sheet.isStatRelevant('dhit'),
                extraClasses: ['stat-col', 'chance-stat-col', 'stat-col-less-important'],
                rowCondition: noSeparators,
            },
            {
                shortName: "det",
                displayName: "DET",
                getter: gearSet => ({
                    stat: gearSet.computedStats.determination,
                    multiplier: gearSet.computedStats.detMulti,
                }) as MultiplierStat,
                renderer: multiplierStatDisplay,
                condition: () => this.sheet.isStatRelevant('determination'),
                extraClasses: ['stat-col', 'multiplier-stat-col', 'stat-col-less-important'],
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
            col({
                shortName: "piety",
                displayName: "PIE",
                getter: gearSet => gearSet.computedStats.piety,
                initialWidth: statColWidth,
                condition: () => this.sheet.isStatRelevant('piety'),
                rowCondition: noSeparators,
                extraClasses: ['stat-col-less-important'],
            }),
            col({
                shortName: "tenacity",
                displayName: "TNC",
                getter: gearSet => ({
                    stat: gearSet.computedStats.tenacity,
                    multiplier: gearSet.computedStats.tncMulti,
                    incomingMulti: gearSet.computedStats.tncIncomingMulti,
                }) as MultiplierMitStat,
                renderer: multiplierMitStatDisplay,
                condition: () => this.sheet.isStatRelevant('tenacity'),
                extraClasses: ['stat-col', 'multiplier-mit-stat-col', 'stat-col-less-important'],
                rowCondition: noSeparators,
            }),
        ];
    }

    // TODO: this is kinda bad, cross-talk between columns despite there being no reason to do so,
    // plus you want changes to immediately invalidate. I guess setting the inactivity time to 0 works?
    private dirtySimColColors: SimulationGui<any, any, any>[] = [];
    private readonly simColColorsTimer = new Inactivitytimer(0, () => this.reprocessSimColsColor());

    requestProcessSimColColor(sim: SimulationGui<any, any, any>) {
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
        this.dirtySimColColors = [...this.simGuis];
        this.simColColorsTimer.ping();
    }

    reprocessSimColColor(sim: SimulationGui<any, any, any>) {
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
            const worstValue = worst[1];
            const bestValue = best[1];
            const percentWorse = worstValue / bestValue;
            if (percentWorse === 1) {
                // The results are all the same. Return.
                return;
            }
            for (const [cell, value] of processed) {
                cell.classList.add('sim-column-valid');
                const fivePercentWorse = 0.95;
                // This value represents the percent worse this value is, e.g. 0.985 for 98.5% as good.
                const percentWorseComparedToBest = value / bestValue;
                // e.g. 2.5 if our value was 0.975
                const numberToBeProcessed = 100 * (percentWorseComparedToBest - fivePercentWorse);

                // This is five percent or more worse than the best rating. Give it the worst rating we can.
                if (numberToBeProcessed <= 0) {
                    cell.style.setProperty('--sim-result-relative', '0%');
                    cell.classList.add('sim-column-worst');
                }
                else {
                    // Log base 1.017 on our number -- which makes anything just below five or above be considered worst gradient.
                    // We use a logarithmic scale so that the percentage gets less favourable the further away from the best it is.
                    const percentageScore = Math.log(numberToBeProcessed + 1) / Math.log(1.018);
                    const adjustedPercentageScore = Math.min(Math.max(percentageScore, 0), 100);
                    cell.style.setProperty('--sim-result-relative', adjustedPercentageScore.toFixed(1) + '%');
                    if (value === bestValue) {
                        cell.style.setProperty('--sim-result-relative', '100%');
                        cell.classList.add('sim-column-best');
                    }
                }
            }
        }
    }

}

export class SimResultDetailDisplay<X extends SimResult> extends HTMLElement {
    private _result: SimCurrentResult<X>;
    private sim: SimulationGui<X, any, any>;

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
                this.replaceChildren(this.sim.makeResultDisplay(this._result.result));
            }
            else {
                // TODO: style this properly
                const tbl = simpleKvTable(this._result.result);
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

    constructor(private gearPlanTable: GearPlanTable, private simGui: SimulationGui<any, any, any>, simCurrentResult: SimCurrentResult<any>) {
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
            if (this.simGui.makeToolTip) {
                tooltip = this.simGui.makeToolTip(this._result.result);
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
        this.gearPlanTable.requestProcessSimColColor(this.simGui);
    }
}

function makeDescriptionHolder(text: string): HTMLElement {
    const fullParagraphs = stringToParagraphs(text);
    const out = new ExpandableText();
    out.classList.add('set-description-holder');
    out.setChildren(fullParagraphs);
    return out;
}

function stringToParagraphs(text: string): HTMLParagraphElement[] {
    return text.trim().split('\n').map(line => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
    });
}

/**
 * The set editor portion. Includes the tab as well as controls for the set name and such.
 */
export class GearSetEditor extends HTMLElement {
    private readonly sheet: GearPlanSheet;
    private readonly gearSet: CharacterGearSet;
    private gearTables: GearItemsTable[] = [];
    private header: HTMLHeadingElement;
    private desc: ExpandableText;
    private issuesButtonContent: HTMLSpanElement;
    private foodTable: FoodItemsTable;

    constructor(sheet: GearPlanSheet, gearSet: CharacterGearSet) {
        super();
        this.sheet = sheet;
        this.gearSet = gearSet;
        this.setup();
    }

    formatTitleDesc(): void {
        this.header.textContent = this.gearSet.name;
        const trimmedDesc = this.gearSet.description?.trim();
        if (trimmedDesc) {
            this.desc.style.display = '';
            this.desc.setChildren(stringToParagraphs(trimmedDesc));
        }
        else {
            this.desc.style.display = 'none';
        }
    }

    checkIssues(): void {
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
        this.desc = new ExpandableText();
        this.desc.classList.add('set-description-holder');
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
            issuesButton,
        ]);
        if (this.sheet.isMultiJob) {
            buttonArea.prepend(new DataSelect(
                this.sheet.allJobs,
                job => job,
                job => this.gearSet.jobOverride = job,
                this.gearSet.job
            ));
        }

        this.appendChild(buttonArea);

        // Put items in categories by slot
        // Not enough to just use the items, because rings can be in either ring slot, so we
        // need options to reflect that.
        const itemMapping: Map<DisplayGearSlot, GearItem[]> = new Map();
        this.sheet.itemsForDisplay
            .filter(item => item.usableByJob(this.gearSet.job))
            .forEach((item) => {
                const slot = item.displayGearSlot;
                if (itemMapping.has(slot)) {
                    itemMapping.get(slot).push(item);
                }
                else {
                    itemMapping.set(slot, [item]);
                }
            });

        const leftSideSlots = ['Head', 'Body', 'Hand', 'Legs', 'Feet'] as const;
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingRight', 'RingLeft'] as const;

        const showHideAllCallback = () => {
            this.gearTables.forEach(tbl => tbl.recheckHiddenSlots());
        };

        const weaponTable = new GearItemsTable(this.sheet, this.gearSet, itemMapping, this.gearSet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon'], showHideAllCallback);
        const leftSideDiv = document.createElement('div');
        const rightSideDiv = document.createElement('div');

        this.gearTables = [weaponTable];

        for (const slot of leftSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot], showHideAllCallback);
            leftSideDiv.appendChild(table);
            this.gearTables.push(table);
        }
        for (const slot of rightSideSlots) {
            const table = new GearItemsTable(this.sheet, this.gearSet, itemMapping, [slot], showHideAllCallback);
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
        this.foodTable = new FoodItemsTable(this.sheet, this.gearSet);
        this.foodTable.classList.add('food-table');
        // foodTable.id = "food-items-table";
        this.appendChild(this.foodTable);
        this.checkIssues();
    }

    refreshMateria() {
        this.gearTables.forEach(tbl => tbl.refreshMateria());
        this.checkIssues();
    }

    showIssuesModal(): void {
        new SetIssuesModal(this.gearSet).attachAndShowExclusively();
    }

    refresh() {
        this.checkIssues();
        this.foodTable.refreshFull();
    }

    private undoRedoHotkeyHandler = (ev: KeyboardEvent) => {
        // Ctrl-Z = undo
        // Ctrl-Shift-Z = redo
        if (ev.ctrlKey && ev.key.toLowerCase() === 'z') {
            // ignore anything that would naturally handle an undo
            if (ev.target instanceof Element) {
                const tag = ev.target.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'select' || tag === 'textarea') {
                    return;
                }
            }
            if (ev.shiftKey) {
                this.gearSet.redo();
            }
            else {
                this.gearSet.undo();
            }
        }
    };

    connectedCallback() {
        window.addEventListener('keydown', this.undoRedoHotkeyHandler);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this.undoRedoHotkeyHandler);
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

        this.header.textContent = this.gearSet.name.trim().length === 0 ? "<No Name>" : this.gearSet.name;
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
            const linkUrl = makeUrl(new NavState(hash.slice(1), undefined, getCurrentState().onlySetIndex));
            linkUrl.searchParams.delete(ONLY_SET_QUERY_PARAM);
            headingLink.href = linkUrl.toString();
            headingLink.target = '_blank';
            headingLink.addEventListener('click', () => {
                recordSheetEvent("openEmbedToFull", this.sheet);
            });
            headingLink.replaceChildren(this.gearSet.name);
            heading.replaceChildren(headingLink);
        }
        else {
            heading.textContent = this.gearSet.name;
        }
        this.appendChild(heading);

        if (this.gearSet.description) {
            const descContainer = makeDescriptionHolder(this.gearSet.description);
            this.appendChild(descContainer);
        }

        const anchorForEmbed = document.createElement('a');
        anchorForEmbed.id = 'embed-stats-placeholder';
        this.appendChild(anchorForEmbed);

        if (!this.sheet.isEmbed) {
            const matTotals = new MateriaTotalsDisplay(this.gearSet);
            if (!matTotals.empty) {
                this.appendChild(matTotals);
            }
        }

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
        const rightSideSlots = ['Ears', 'Neck', 'Wrist', 'RingRight', 'RingLeft'] as const;

        if (itemMapping.get('Weapon') || itemMapping.get('OffHand')) {
            const weaponTable = new GearItemsViewTable(this.sheet, this.gearSet, itemMapping, this.gearSet.classJobStats.offhand ? ['Weapon', 'OffHand'] : ['Weapon']);
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
            const foodTable = new FoodItemViewTable(this.sheet, this.gearSet, food);
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
    simGui: SimulationGui<any, SettingsType, any>,
    refreshColumn: (item: SimulationGui<any, SettingsType, any>) => void,
    deleteColumn: (item: SimulationGui<any, SettingsType, any>) => void,
    refreshHeaders: () => void): HTMLElement {

    const outerDiv = document.createElement("div");
    outerDiv.id = 'sim-config-area-outer';
    outerDiv.classList.add('sim-config-area-outer');

    // const header = document.createElement("h1");
    // header.textContent = "Configuring " + sim.displayName;
    // outerDiv.appendChild(header);
    if (sheet.isViewOnly) {
        const title = document.createElement('h1');
        title.textContent = simGui.sim.displayName;
    }
    else {
        const titleEditor = new FieldBoundTextField(simGui.sim, 'displayName');
        titleEditor.addListener(val => {
            refreshHeaders();
        });
        titleEditor.classList.add('sim-name-editor');
        titleEditor.title = 'Rename this simulation';
        outerDiv.appendChild(titleEditor);
        const deleteButton = makeActionButton("Delete", () => deleteColumn(simGui));
        outerDiv.appendChild(deleteButton);
    }
    const auto = !simGui.sim.manualRun;
    const rerunAction = () => refreshColumn(simGui);
    if (!auto) {
        const rerunButton = makeActionButton("Rerun", rerunAction);
        outerDiv.appendChild(rerunButton);
    }
    const rerunTimer = new Inactivitytimer(300, rerunAction);

    const originalSettings: SettingsType = simGui.sim.settings;
    const updateCallback = () => {
        simGui.sim.settingsChanged();
        sheet.requestSave();
        if (auto) {
            rerunTimer.ping();
        }
    };
    const settingsProxy = writeProxy(originalSettings, () => {
        updateCallback();
    });
    const customInterface = simGui.makeConfigInterface(settingsProxy, updateCallback);
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
    private _defaultSelectionIndex: number | undefined = undefined;
    readonly headerArea: HTMLDivElement;
    readonly headerBacklinkArea: HTMLDivElement;
    readonly tableArea: HTMLDivElement;
    readonly tableHolderOuter: HTMLDivElement;
    readonly tableHolder: HTMLDivElement;
    readonly buttonsArea: HTMLDivElement;
    readonly editorArea: HTMLDivElement;
    readonly midBarArea: HTMLDivElement;
    readonly toolbarHolder: HTMLDivElement;
    private _simGuis: SimulationGui<any, any, any>[];
    private specialStatDropdown: FieldBoundDataSelect<GearPlanSheet, SpecialStatType | null>;

    get simGuis() {
        return this._simGuis;
    }

    toolbarNode: Node | undefined;
    // TODO: SimResult alone might not be enough since we'd want it to refresh automatically if settings are changed
    private _editorItem: CharacterGearSet | SimulationGui<any, any, any> | SimResultData<SimResult> | undefined;

    // Can't make ctor private for custom element, but DO NOT call this directly - use fromSaved or fromScratch
    constructor(...args: ConstructorParameters<typeof GearPlanSheet>) {
        super(...args);
        this._simGuis = super.sims.map(sim => makeGui(sim));
        this.element = new GearPlanSheetElement();
        const element = this.element;
        element.classList.add('gear-sheet');
        element.classList.add('loading');
        this.headerArea = document.createElement('div');
        this.headerArea.classList.add('header-area');
        this.headerBacklinkArea = document.createElement('div');
        this.headerBacklinkArea.classList.add('header-backlink-area');
        this.headerBacklinkArea.style.display = 'none';
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
        element.appendChild(this.headerBacklinkArea);
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

    get defaultSelectionIndex(): number | undefined {
        return this._defaultSelectionIndex;
    }

    set defaultSelectionIndex(value: number | undefined) {
        this._defaultSelectionIndex = value;
    }

    private get editorItem() {
        return this._editorItem;
    }

    private set editorItem(item: typeof this._editorItem) {
        this._editorItem = item;
        if (this.isViewOnly) {
            this.headerArea.style.display = 'none';
        }
        this.resetEditorArea();
    }

    get selectedGearSet(): CharacterGearSet | null {
        if (this._editorItem instanceof CharacterGearSet) {
            return this._editorItem;
        }
        return null;
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
                window.currentGearSet = item;
                if (item.isSeparator) {
                    if (this.isViewOnly) {
                        this.setupEditorArea(new SeparatorViewer(item));
                    }
                    else {
                        this.setupEditorArea(new SeparatorEditor(item));
                    }
                }
                else {
                    if (this.isViewOnly) {
                        this.setupEditorArea(new GearSetViewer(this, item));
                    }
                    else {
                        this.setupEditorArea(new GearSetEditor(this, item));
                    }
                }
                this.refreshToolbar();
            }
            else if ('makeConfigInterface' in item) {
                this.setupEditorArea(formatSimulationConfigArea(this, item as SimulationGui<any, any, any>, col => this._gearPlanTable.refreshColumn(col), col => this.delSim(col.sim), () => this._gearPlanTable.refreshColHeaders()));
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


    private setupRealGui() {
        const buttonsArea = this.buttonsArea;
        const showHideButton = makeActionButton('≡', () => {
            const cls = 'showing';
            buttonsArea.classList.contains(cls) ? buttonsArea.classList.remove(cls) : buttonsArea.classList.add(cls);
        });
        showHideButton.classList.add('show-hide-button');
        buttonsArea.appendChild(showHideButton);

        this._gearPlanTable = new GearPlanTable(this, item => this.editorItem = item);
        this.showAdvancedStats = SETTINGS.viewDetailedStats ?? false;

        const sheetOptions = new DropdownActionMenu('More Actions...');

        const siFmt = formatSyncInfo(this.syncInfo, this.level);
        if (siFmt !== null) {
            const span = quickElement('span', [], [siFmt]);
            const ilvlSyncLabel = quickElement('div', ['like-a-button', 'level-sync-info'], [span]);
            ilvlSyncLabel.title = 'To change the item level sync, click the "Save As" button to create a new sheet with a different level/ilvl.';
            buttonsArea.appendChild(ilvlSyncLabel);
        }

        if (!this.isViewOnly) {
            const addRowButton = makeActionButton("New Gear Set", () => {
                const newSet = new CharacterGearSet(this);
                newSet.name = "New Set";
                this.addGearSet(newSet, undefined, true);
            });
            buttonsArea.appendChild(addRowButton);

            sheetOptions.addAction({
                label: 'Name/Description',
                action: () => startRenameSheet(this),
            });
            sheetOptions.addAction({
                label: 'Manage Custom Items',
                action: () => new CustomItemPopup(this).attachAndShowExclusively(),
            });
            sheetOptions.addAction({
                label: 'Manage Custom Food',
                action: () => new CustomFoodPopup(this).attachAndShowExclusively(),
            });
            sheetOptions.addAction({
                label: 'Add Separator',
                action: () => {
                    const set = new CharacterGearSet(this);
                    set.name = 'Separator';
                    set.isSeparator = true;
                    this.addGearSet(set, undefined, true);
                },
            });
            buttonsArea.appendChild(sheetOptions);
        }
        sheetOptions.addAction({
            label: 'Sheet/Set Info...',
            action: () => {
                const selectedGearSet = this.selectedGearSet;
                new SheetInfoModal(this, selectedGearSet).attachAndShowExclusively();
            },
        });

        if (this.isViewOnly) {
            const saveAsButton = makeActionButton("Save As", () => {
                const modal = new SaveAsModal(this, newSheet => openSheetByKey(newSheet.saveKey));
                modal.attachAndShowExclusively();
            });
            buttonsArea.appendChild(saveAsButton);
            buttonsArea.appendChild(sheetOptions);
        }
        else {
            sheetOptions.addAction({
                label: 'Save As',
                action: () => {
                    const modal = new SaveAsModal(this, newSheet => openSheetByKey(newSheet.saveKey));
                    modal.attachAndShowExclusively();
                },
            });
        }

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
                    const selection = sheet.selectedGearSet;
                    if (!selection) {
                        alert("Select a gear set first");
                    }
                    else {
                        startExport(selection);
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
        raceDropdown.addListener((val) => {
            recordSheetEvent('changeRace', this, {
                race: val,
            });
        });

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
            rangeInc(0, MAX_PARTY_BONUS) as PartyBonusAmount[]
        );
        partySizeDropdown.addListener((val) => {
            recordSheetEvent('changePartyBonus', this, {
                partyBonus: val,
            });
        });
        buttonsArea.appendChild(partySizeDropdown);

        // TODO: this should only show once you select an occult crescent item
        this.specialStatDropdown = new FieldBoundDataSelect<GearPlanSheet, SpecialStatType | null>(
            this,
            'activeSpecialStat',
            value => {
                switch (value) {
                    case null:
                        return 'No Special Stats';
                    // case SpecialStatType.OccultCrescent:
                    //     return 'Occult Crescent';
                    default:
                        return camel2title(value);
                }
            },
            [null, ...Object.values(SpecialStatType)]
        );
        // TODO: move this logic to xivconstants or something
        // We only want this to show if our sheet looks like it might be for one of these duties with special bonuses,
        // or if the user somehow got into a state where they have a special stat set despite the sheet normally
        // not being eligible for one.
        if (!(this.activeSpecialStat || (this.level === 100 && this.ilvlSync === 700))) {
            this.specialStatDropdown.style.display = 'none';
        }
        buttonsArea.appendChild(this.specialStatDropdown);

        if (this.saveKey) {
            this.headerArea.style.display = 'none';
        }
        else {
            if (this.isViewOnly) {
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
                unsavedWarning.textContent = 'This imported sheet will not be saved unless you use the "Save As" button in the "More Actions..." menu below the table.';
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

        function doSet(f: (set: CharacterGearSet) => void): void {
            const set = outer.selectedGearSet;
            if (set) {
                f(set);
                if (outer._editorAreaNode instanceof GearSetEditor) {
                    outer._editorAreaNode.refreshMateria();
                }
            }
        }

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
                doSet(set => set.fillMateria(outer.materiaAutoFillPrio, true));
            },
            fillEmpty(): void {
                doSet(set => set.fillMateria(outer.materiaAutoFillPrio, false));
            },
            lockEmpty(): void {
                doSet(set => {
                    set.forEachMateriaSlot((_key, _item, slot) => {
                        if (!slot.equippedMateria) {
                            slot.locked = true;
                        }
                    });
                    // Only save - no recalc
                    set.nonRecalcNotify();
                });
            },
            lockFilled(): void {
                doSet(set => {
                    set.forEachMateriaSlot((_key, _item, slot) => {
                        if (slot.equippedMateria) {
                            slot.locked = true;
                        }
                    });
                    set.nonRecalcNotify();
                });
            },
            unequipUnlocked(): void {
                doSet(set => {
                    set.forEachMateriaSlot((_key, _item, slot) => {
                        if (!slot.locked) {
                            slot.equippedMateria = null;
                        }
                    });
                    set.forceRecalc();
                });
            },
            unlockAll(): void {
                doSet(set => {
                    set.forEachMateriaSlot((_key, _item, slot) => {
                        slot.locked = false;
                    });
                    set.nonRecalcNotify();
                });
            },
        };
        this._materiaAutoFillController = matFillCtrl;
        this._gearEditToolBar = new GearEditToolbar(
            this,
            this.itemDisplaySettings,
            () => this.gearDisplaySettingsUpdateNow(),
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
            const altDragTarget = this.toolbarNode;
            if (ev.target !== dragTarget && ev.target !== altDragTarget) {
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

        if (this._defaultSelectionIndex !== undefined) {
            const characterGearSet = this.sets[this._defaultSelectionIndex];
            if (characterGearSet) {
                this._gearPlanTable.selectGearSet(characterGearSet);
            }
            else {
                console.error("Invalid selection index", this._defaultSelectionIndex);
            }
        }
        else if (this._selectFirstRowByDefault && this.sets.length >= 1) {
            // First, try to select a real gear set
            const firstNonSeparator = this.sets.find(set => !set.isSeparator);
            // Failing that, just select whatever
            this._gearPlanTable.selectGearSet(firstNonSeparator ?? this.sets[0]);
        }
        this._sheetSetupDone = true;
    }

    /**
     * Refresh all materia widgets on the current sheet.
     */
    public refreshMateria() {
        if (this._editorAreaNode instanceof GearSetEditor) {
            this._editorAreaNode.refreshMateria();
        }
    }

    /**
     * The top-level element which is to be added to the page.
     */
    get topLevelElement() {
        return this.element;
    }

    async load() {
        await super.load();
        this.setupRealGui();
    }

    /**
     * Called when gear filters have been changed. It will eventually result in gear lists being refreshed, but with
     * a delay such that multiple successive updates are coalesced into a single refresh.
     */
    gearDisplaySettingsUpdateLater() {
        this.gearUpdateTimer.ping();
    }

    gearDisplaySettingsUpdateNow() {
        this.gearUpdateTimer.runNext();
    }

    get materiaAutoFillController() {
        return this._materiaAutoFillController;
    }

    private _editorAreaNode: Node | undefined;

    private setToolbarNode(node: Node | undefined) {
        this.toolbarNode = node;
        if (node !== undefined) {
            this.toolbarHolder.replaceChildren(node);
        }
        else {
            this.toolbarHolder.replaceChildren();
        }
    }

    private setupEditorArea(node: (Node & {
        toolbar?: Node
    }) | undefined = undefined) {
        this._editorAreaNode = node;
        if (node === undefined) {
            this.editorArea.replaceChildren();
            this.editorArea.style.display = 'none';
            this.midBarArea.style.display = 'none';
            this.setToolbarNode(undefined);
        }
        else {
            this.editorArea.replaceChildren(node);
            this.editorArea.style.display = '';
            // midbar should be displayed no matter what since it also provides the visual delineation between
            // the top half and the bottom half, even if it isn't needed for displaying any content.
            this.midBarArea.style.display = '';
            // if ('makeToolBar' in node) {
            if (node instanceof GearSetEditor) {
                this.setToolbarNode(this._gearEditToolBar);
            }
            else if ('toolbar' in node) {
                this.setToolbarNode(node.toolbar);
            }
            else {
                this.setToolbarNode(undefined);
            }
            // TODO: clean this up
            if (node instanceof GearSetViewer) {
                this.editorArea.style.position = 'relative';
                if (!this.isEmbed) {
                    insertAds(this.editorArea);
                }
            }
        }
    }

    addGearSet(gearSet: CharacterGearSet, index?: number, select: boolean = false) {
        super.addGearSet(gearSet, index);
        this._gearPlanTable?.dataChanged();
        gearSet.addListener(() => {
            if (this._gearPlanTable) {
                this._gearPlanTable.refreshRowData(gearSet);
                this.refreshToolbar();
                if (this._editorItem === gearSet && 'refresh' in this._editorAreaNode) {
                    (this._editorAreaNode.refresh as () => void)();
                }
            }
            this.requestSave();
        });
        if (select && this._gearPlanTable) {
            this._gearPlanTable.selectGearSet(gearSet);
        }
        gearSet.startCheckpoint(() => this.refreshGearEditor(gearSet));
    }

    /**
     * Fully refresh the gear editor area.
     *
     * @param set If specified, will only perform the refresh if this is the currently selected set.
     */
    refreshGearEditor(set?: CharacterGearSet) {
        if (!set || this._editorItem === set) {
            this.resetEditorArea();
            // this.refreshToolbar();
        }
    }

    /**
     * Refreshes the toolbar. Should be called when switching sets.
     */
    refreshToolbar() {
        if (this.selectedGearSet !== null) {
            if (this.toolbarNode !== undefined && 'refresh' in this.toolbarNode && typeof this.toolbarNode.refresh === 'function') {
                this.toolbarNode.refresh(this._editorItem);
            }
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
        cloned.name += ' copy';
        const toIndex: number | undefined = this.clonedSetPlacement(gearSet);
        this.addGearSet(cloned, toIndex, select);
    }


    addSim(sim: Simulation<any, any, any>) {
        super.addSim(sim);
        this._simGuis.push(makeGui(sim));
        this.gearPlanTable?.simsChanged();
    }

    delSim(sim: Simulation<any, any, any>) {
        this._simGuis = this._simGuis.filter(s => s.sim !== sim);
        super.delSim(sim);
        this.gearPlanTable?.simsChanged();
    }

    /**
     * Show the add simulation modal.
     */
    showAddSimDialog() {
        const addSimDialog = new AddSimDialog(this);
        document.querySelector('body').appendChild(addSimDialog);
        addSimDialog.showExclusively();
    }

    /**
     * Show the meld solving modal.
     */
    showMeldSolveDialog() {
        const selectedSet = this.selectedGearSet;
        if (!selectedSet) {
            return;
        }
        if (this.sims.length === 0) {
            alert('You must add a simulation to the sheet before you can use the meld solver.');
            return;
        }
        const meldSolveDialog = new MeldSolverDialog(this, selectedSet);
        document.querySelector('body').appendChild(meldSolveDialog);
        meldSolveDialog.showExclusively();
    }

    /**
     * The gear sheets table.
     */
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
        dialog.attachAndShowExclusively();
    }

    get sheetName() {
        return super.sheetName;
    }

    set sheetName(name: string) {
        super.sheetName = name;
        setTitle(this.sheetName);
    }

    /**
     * Save data for this sheet now.
     */
    saveData() {
        if (!this.setupDone) {
            // Don't clobber a save with empty data because the sheet hasn't loaded!
            return;
        }
        if (this.saveKey) {
            console.log("Saving sheet " + this.sheetName);
            this._timestamp = new Date();
            this.sheetManager.saveData(this);
        }
        else {
            console.debug("Ignoring request to save sheet because it has no save key");
        }
    }


    configureBacklinkArea(sheetName: string, sheetUrl: URL): void {
        const area = this.headerBacklinkArea;
        const linkElement = document.createElement('a');
        linkElement.href = sheetUrl.toString();
        linkElement.textContent = sheetName;
        linkElement.addEventListener('click', () => {
            recordEvent('openNormalBacklink');
        });
        if (isInIframe()) {
            linkElement.target = '_blank';
        }
        else {
            // Don't fully reload the page for no reason
            linkElement.addEventListener('click', (e) => {
                const existingUrl = new URL(document.location.toString());
                if (existingUrl.origin === sheetUrl.origin
                    && existingUrl.pathname === sheetUrl.pathname) {
                    e.preventDefault();
                    history.pushState(null, null, sheetUrl);
                    processNav();
                }
            });
        }
        area.replaceChildren("This set is part of a sheet: ", linkElement);
        area.style.display = '';
    }

    get activeSpecialStat(): SpecialStatType | null {
        return super.activeSpecialStat;
    }

    set activeSpecialStat(value: SpecialStatType | null) {
        super.activeSpecialStat = value;
        this.resetEditorArea();
    }

    showChangePropertiesDialog(): void {
        if (!this.saveKey) {
            alert('You must save this sheet before changing its properties. Use "Save As" first.');
            return;
        }
        new ChangePropsModal(this).attachAndShowExclusively();
    }
}

export class ChangePropsModal extends BaseSheetSettingsModal {
    constructor(private readonly sheet: GearPlanSheetGui) {
        super({
            name: sheet.sheetName,
            job: sheet.classJobName,
            level: sheet.level,
            ilvlSyncEnabled: sheet.ilvlSync !== undefined,
            ilvlSyncLevel: sheet.ilvlSync,
            allowedRoles: [JOB_DATA[sheet.classJobName].role],
            multiJob: sheet.isMultiJob,
        }, 'Apply');
        this.headerText = 'Change Sheet Properties';
    }

    protected onSubmit(): void {
        const desiredJob = this.selectedJob ?? this.sheet.classJobName;
        const desiredMultiJob = this.multiJob;

        const newName = this.nameValue;
        const newLevel = this.level;
        const newIlvl = this.ilvlSyncEnabled ? this.ilvlSync : undefined;

        if (!this.confirmJobMultiChange(this.sheet.classJobName, this.sheet.isMultiJob, desiredJob, desiredMultiJob)) {
            return;
        }
        const jobOrMultiChanged = (desiredJob !== this.sheet.classJobName) || (desiredMultiJob !== this.sheet.isMultiJob);
        if (jobOrMultiChanged) {
            // Create a new sheet when changing job or multi-job, then open it
            const newKey: string = this.sheet.saveAs(
                newName,
                desiredJob,
                newLevel as SupportedLevel,
                newIlvl,
                desiredMultiJob
            );
            // Navigate to the newly created sheet
            openSheetByKey(newKey);
            this.close();
            return;
        }

        const changed = (this.sheet.sheetName !== newName)
            || (this.sheet.level !== newLevel)
            || (this.sheet.ilvlSync !== newIlvl);
        if (!changed) {
            this.close();
            return;
        }

        // Apply in-place updates for name/level/ilvl sync
        this.sheet.sheetName = newName;
        this.sheet.level = newLevel as SupportedLevel;
        this.sheet.ilvlSync = newIlvl;
        // Save immediately and reload the current sheet
        this.sheet.saveData();
        if (this.sheet.saveKey) {
            openSheetByKey(this.sheet.saveKey);
        }
        this.close();
    }
}

if (!customElements.get('change-props-modal')) {
    customElements.define('change-props-modal', ChangePropsModal);
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
        const nonMatchingJobs = importedJobs.filter(job => !this.sheet.allJobs.includes(job));
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
                        this.doJsonImport(parsed.rawData, undefined);
                    }
                    catch (e) {
                        console.error('Import error', e);
                        alert('Error importing');
                    }
                    return;
                case "shortlink":
                    this.doAsyncImport(() => getShortLink(decodeURIComponent(parsed.rawUuid)), parsed.onlySetIndex);
                    return;
                case "etro":
                    this.ready = false;
                    Promise.all(parsed.rawUuids.map(getSetFromEtro)).then(sets => {
                        if (!this.checkJob(false, ...sets.map(set => set.job))) {
                            this.ready = true;
                            return;
                        }
                        sets.forEach(set => {
                            this.sheet.addGearSet(this.sheet.importGearSet(set), undefined, true);
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
                    this.doAsyncImport(() => getBisSheet(parsed.path), parsed.onlySetIndex);
                    return;
            }
        }
        console.error("Error loading imported data", text);
        alert('That doesn\'t look like a valid import.');
    }

    doAsyncImport(provider: () => Promise<string>, onlySetIndex: number | undefined) {
        this.ready = false;
        provider().then(raw => {
            this.doJsonImport(raw, onlySetIndex);
            this.ready = true;
        }, err => {
            this.ready = true;
            console.error("Error importing set/sheet", err);
            alert('Error loading set/sheet');
        });
    }

    doJsonImport(text: string, onlySetIndex: number | undefined) {
        const rawImport = JSON.parse(text);
        if ('sets' in rawImport && rawImport.sets.length) {
            if (!this.checkJob(true, rawImport.job)) {
                return;
            }
            const sets: SetExport[] = rawImport.sets;
            if (onlySetIndex !== undefined) {
                const theSet = sets[onlySetIndex];
                if (!theSet) {
                    console.error(`Index ${onlySetIndex} is not valid with sets length of ${sets.length}`);
                    alert("Not valid");
                }
                const imported = this.sheet.importGearSet(theSet);
                this.sheet.addGearSet(imported, undefined, true);
            }
            else {
                // import everything
                if (confirm(`This will import ${rawImport.sets.length} gear sets into this sheet.`)) {
                    const imports = sets.map(set => this.sheet.importGearSet(set));
                    for (let i = 0; i < imports.length; i++) {
                        // Select the first imported set
                        const set = imports[i];
                        this.sheet.addGearSet(set, undefined, i === 0);
                    }
                }
            }
            this.close();
        }
        else if ('name' in rawImport && 'items' in rawImport) {
            if (!this.checkJob(false, rawImport.job)) {
                return;
            }
            this.sheet.addGearSet(this.sheet.importGearSet(rawImport), undefined, true);
            this.close();
        }
        else {
            alert("That doesn't look like a valid sheet or set");
        }

    }
}

export class AddSimDialog extends BaseModal {
    private readonly table: CustomTable<SimSpec<any, any>, TableSelectionModel<SimSpec<any, any>>>;
    private _showAllSims: boolean = false;

    constructor(private sheet: GearPlanSheet) {
        super();
        this.id = 'add-sim-dialog';
        this.headerText = 'Add Simulation';
        const form = document.createElement("form");
        form.method = 'dialog';
        this.table = new CustomTable();
        const selModel = new SingleRowSelectionModel<SimSpec<any, any>>();
        this.table.selectionModel = selModel;
        this.table.classList.add('hoverable');
        this.table.columns = [
            col({
                shortName: 'sim-job-icon',
                displayName: 'Icon',
                // fixedWidth: 500,
                getter: item => item.supportedJobs,
                renderer: (value) => {
                    if (!value) {
                        return document.createTextNode('');
                    }
                    if (value.length === 1) {
                        return new JobIcon(value[0]);
                    }
                    // TODO: use role icon for sims that support entire roles
                    // Role icons start at 062581
                    return document.createTextNode('');
                },
            }),
            col({
                shortName: 'sim-name',
                displayName: 'Name',
                // fixedWidth: 500,
                getter: item => item.displayName,
            }),
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
        const cancelButton = makeActionButton("Cancel", () => this.close());
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
            },
        });
        this.contentArea.append(form);
    }

    submit() {
        const sel = this.table.selectionModel.getSelection();
        if (sel instanceof CustomRow) {
            this.sheet.addSim(sel.dataItem.makeNewSimInstance());
            this.close();
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
        super((...args) => new GearPlanSheetGui(...args), SHEET_MANAGER);
    }

    override fromExport(importedData: SheetExport): GearPlanSheetGui {
        const out = super.fromExport(importedData);
        out.setSelectFirstRowByDefault();
        return out;
    }

    override fromSetExport(...importedData: SetExport[]): GearPlanSheetGui {
        const out = super.fromSetExport(...importedData);
        out.setSelectFirstRowByDefault();
        return out;
    }

    override fromSaved(sheetKey: string): GearPlanSheetGui | null {
        const out = super.fromSaved(sheetKey);
        out?.setSelectFirstRowByDefault();
        return out;
    }
}

function formatSyncInfo(si: SyncInfo, level: SupportedLevel): string | null {
    const isIlvlSynced = si.ilvlSync !== null;
    const isLvlSynced = si.lvlSync !== null;
    if (isIlvlSynced || isLvlSynced) {
        let text = 'Sync: ';
        if (isLvlSynced) {
            text += `lv${si.lvlSync} `;
        }
        else if (si.ilvlSync !== null) {
            // If level sync isn't explicitly set, show the level anyway
            // if item level sync is present in any way to avoid confusion.
            text += `lv${level} `;
        }
        if (si.ilvlSync !== null) {
            // TODO: when strict mode is finished, fix this a bit.
            if ('ilvlSyncIsExplicit' in si && si.ilvlSyncIsExplicit) {
                text += `i${si.ilvlSync}`;
            }
            else {
                text += `(i${si.ilvlSync})`;
            }
        }
        return text;
    }
    return null;
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
