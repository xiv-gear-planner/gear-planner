/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: get back to fixing this at some point
import {camel2title, capitalizeFirstLetter, toRelPct} from "@xivgear/util/strutils";
import {
    col,
    CustomCell,
    CustomColumn,
    CustomColumnSpec,
    CustomRow,
    CustomTable,
    HeaderRow,
    SingleCellRowOrHeaderSelectionModel,
    SpecialRow
} from "@xivgear/common-ui/table/tables";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {
    el,
    FieldBoundDataSelect,
    FieldBoundTextField,
    makeActionButton,
    quickElement
} from "@xivgear/common-ui/components/util";
import {
    ChanceStat,
    ComputedSetStats,
    MateriaAutoFillController,
    MateriaAutoFillPrio,
    MateriaFillMode,
    MultiplierMitStat,
    MultiplierStat,
    PartyBonusAmount,
    RawStatKey
} from "@xivgear/xivmath/geartypes";
import {CharacterGearSet, SyncInfo} from "@xivgear/core/gear";
import {
    getClassJobStats,
    MAX_PARTY_BONUS,
    RACE_STATS,
    RaceName,
    SpecialStatKey,
    STAT_ABBREVIATIONS,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {processNav} from "../../nav_hash";
import {scrollIntoView} from "@xivgear/common-ui/util/scrollutil";
import {installDragHelper} from "../../util/draghelpers";
import {iconForIssues} from "./gear_set_issues";
import {Inactivitytimer} from "@xivgear/util/inactivitytimer";
import {startExport} from "../export/export_controller";
import {startRenameSet, startRenameSheet} from "./rename_dialog";
import {writeProxy} from "@xivgear/util/proxies";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {GearEditToolbar} from "./toolbar/gear_edit_toolbar";
import {openSheetByKey, setTitle} from "../../base_ui";
import {simpleKvTable} from "../../sims/components/simple_tables";
import {rangeInc} from "@xivgear/util/array_utils";
import {SimCurrentResult, SimResult, SimSettings, Simulation} from "@xivgear/core/sims/sim_types";
import {makeUrlSimple, POPUP_HASH} from "@xivgear/core/nav/common_nav";
import {ChangePropsModal, SaveAsModal} from "../sheetpicker/new_sheet_form";
import {DropdownActionMenu} from "../general/dropdown_actions_menu";
import {CustomFoodPopup, CustomItemPopup} from "./custom_item_manager";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {SimulationGui} from "../../sims/simulation_gui";
import {makeGui} from "../../sims/registration/sim_guis";
import {MeldSolverDialog} from "./editor/meld_solver_modal";
import {insertAds} from "../general/ads";
import {SETTINGS} from "@xivgear/common-ui/settings/persistent_settings";
import {isInIframe} from "@xivgear/common-ui/util/detect_iframe";
import {recordError, recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {SheetInfoModal} from "./sheet_info_modal";
import {FramelessJobIcon} from "../job/job_icon";
import {setDataManagerErrorReporter} from "@xivgear/core/data_api_client";
import {SpecialStatType} from "@xivgear/data-api-client/dataapi";
import {cleanUrl} from "@xivgear/common-ui/nav/common_frontend_nav";
import {isSafari} from "@xivgear/common-ui/util/detect_safari";
import {getNextPopoutContext, MESSAGE_REFRESH_CONTENT, MESSAGE_REFRESH_TOOLBAR} from "../../popout";
import {
    makeCopyIcon,
    makeExportIcon,
    makeImportIcon,
    makeNewSheetIcon,
    makeTrashIcon
} from "@xivgear/common-ui/components/icons";
import {AddSimDialog} from "../sim/add_sim_dialog";
import {ImportSetsModal} from "../import/import_sets_modal";
import {recordSheetEvent} from "../../analytics/analytics";
import {GearSetViewer} from "./editor/set_viewer";
import {stringToParagraphs, textWithToolTip} from "../../util/text_utils";
import {GearSetEditor} from "./editor/set_editor";
import {DataManager} from "@xivgear/core/datamanager";
import {ASYNC_SIM_LOADER} from "../../sims/asyncloader/async_loader";
import {HEALER_MP_SIM_STUB_NAME} from "@xivgear/core/sims/healer/healer_mp_consts";

const noSeparators = (set: CharacterGearSet) => !set.isSeparator;

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

class SimResultData<ResultType extends SimResult> {
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
class GearPlanTable extends CustomTable<CharacterGearSet, SingleCellRowOrHeaderSelectionModel<CharacterGearSet, SimCurrentResult, SimulationGui<any, any, any>>> {

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
                if (this.isConnected) {
                    scrollIntoView(row, 'center');
                    // Do it again just in case the element was immediately resized
                    setTimeout(() => {
                        scrollIntoView(row, 'center');
                    });
                }
                // If not connected yet, then the connectedCallback() method will handle it.
            }
            else {
                console.log(`Tried to select set ${set.name}, but couldn't find it in our row mapping.`);
            }
        }
        this.refreshSelection();
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
        const sel = this.selectionModel.getSelection();
        if (sel instanceof CustomRow) {
            scrollIntoView(sel, 'center');
            // Do it again just in case the element was immediately resized
            setTimeout(() => {
                scrollIntoView(sel, 'center');
            });

        }
    }

    get selectedIndex(): number | null {
        const sel = this.selectionModel.getSelection();
        if (sel instanceof CustomRow && sel.dataItem instanceof CharacterGearSet) {
            const index = this.sheet.sets.indexOf(sel.dataItem);
            if (index >= 0) {
                return index;
            }
        }
        return null;
    }

    dataChanged() {
        const curSelection = this.selectionModel.getSelection();
        super.data = [new HeaderRow(), new SpecialRow(() => {
            return el('div', {class: 'spacer-row'});
        }), ...this.gearSets];
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

    private setupColumns() {
        const viewOnly = this.sheet.isViewOnly;
        if (viewOnly) {
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
                        const haste = gearSet.computedStats.haste(gcdOver.attackType, gcdOver.buffHaste ?? 0, gcdOver.gaugeHaste ?? 0);
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
                        const magHaste = gearSet.computedStats.haste('Spell', 0, 0);
                        const physHaste = gearSet.computedStats.haste('Weaponskill', 0, 0);
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
                    colHeader.firstElementChild?.appendChild(span);
                    // colHeader.append(span);
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
                    div.appendChild(makeActionButton([makeTrashIcon()], (ev) => {
                        if (confirmDelete(ev, `Delete gear set '${gearSet.name}'?`)) {
                            this.sheet.delGearSet(gearSet);
                        }
                    }, 'Delete this set'));
                    div.appendChild(makeActionButton([makeCopyIcon()], () => this.sheet.cloneAndAddGearSet(gearSet, true), 'Clone this set'));
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
                // Special case for MP Sim: we want to show all positive values as green relative
                // to the highest.
                if (sim.sim.spec.stub === HEALER_MP_SIM_STUB_NAME) {
                    cell.classList.add('sim-column-valid');
                    if (value >= 0) {
                        // We do positives relative to 750 MP/Min, so 750 MP or higher will show the brightest greens
                        const bestCaseMpPerMinute = 750;
                        const percentWorseComparedToBest = (value / bestCaseMpPerMinute) * 100;
                        const percentDividedBy2 = percentWorseComparedToBest / 2;
                        const percentage = percentDividedBy2 + 50;
                        const finalPercentage = percentage > 100 ? 100 : percentage;
                        cell.style.setProperty('--sim-result-relative', finalPercentage.toFixed(1) + '%');
                        if (value === bestValue) {
                            cell.classList.add('sim-column-best');
                        }
                    }
                    else {
                        // We do negatives relative to -750 MP/Min, so -750 MP or lower will show the darkest reds
                        const worstCaseMpPerMinute = 750;
                        const percentWorse = (Math.abs(value) / worstCaseMpPerMinute) * 100;
                        const percentDividedBy2 = percentWorse / 2;
                        const percentage = 50 - percentDividedBy2;
                        const finalPercentage = percentage < 0 ? 0 : percentage;
                        cell.style.setProperty('--sim-result-relative', finalPercentage.toFixed(1) + '%');
                    }
                }
                else {
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
}

class SimResultDetailDisplay<X extends SimResult> extends HTMLElement {
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

class SimResultMiniDisplay extends HTMLElement {
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

class SeparatorEditor extends HTMLElement {
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

class SeparatorViewer extends HTMLElement {
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

// Doesn't actually have any custom behavior, but this is the actual gear plan sheet element.
// GearPlanSheetGui is not an element.
class GearPlanSheetElement extends HTMLElement {

}

/**
 * The top-level gear manager, but with graphical support
 */
export class GearPlanSheetGui extends GearPlanSheet {

    protected _materiaAutoFillController: MateriaAutoFillController;
    // Track open popout windows per gear set
    private _openSetPopouts: Map<CharacterGearSet, Window> = new Map();
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
    private specialStatDropdown: FieldBoundDataSelect<GearPlanSheet, SpecialStatKey | null> | null = null;

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
        this.headerArea = el('div', {class: 'header-area'});
        this.headerBacklinkArea = el('div', {class: 'header-backlink-area'});
        this.headerBacklinkArea.style.display = 'none';
        this.tableHolder = el('div', {class: 'gear-sheet-table-holder'});
        this.tableHolderOuter = el('div', {class: 'gear-sheet-table-holder-outer'}, [this.tableHolder]);
        this.tableArea = el("div", {classes: ['gear-sheet-table-area', 'hide-when-loading']}, [this.tableHolderOuter]);
        this.buttonsArea = el("div", {classes: ['gear-sheet-buttons-area', 'hide-when-loading', 'show-hide-parent']});
        this.editorArea = el("div", {classes: ['gear-sheet-editor-area', 'hide-when-loading']});
        this.midBarArea = el("div", {classes: ['gear-sheet-midbar-area', 'hide-when-loading']});
        this.toolbarHolder = el('div', {classes: ['gear-sheet-toolbar-holder', 'hide-when-loading']});
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
        this._gearPlanTable.classList.toggle('show-advanced-stats', show);
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
                        const existing = this._openSetPopouts.get(item);
                        if (existing && !existing.closed) {
                            const header = el('h3', {}, [`${item.name} editor is open in a popout`]);
                            const focusBtn = makeActionButton('Focus Popout', () => {
                                try {
                                    existing.focus();
                                }
                                catch (e) {
                                    // ignore
                                }
                            });
                            const closeBtn = makeActionButton('Close Popout', () => {
                                this.closePopoutForSet(item);
                                this.refreshGearEditor(item);
                            });
                            const btnArea = quickElement('div', ['gear-set-editor-button-area', 'button-row'], [focusBtn, closeBtn]);
                            const wrapper = quickElement('div', ['gear-set-popout-open-placeholder'], [header, btnArea]);
                            this.setupEditorArea(wrapper);
                        }
                        else {
                            this.setupEditorArea(new GearSetEditor(this, item));
                        }
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
            buttonsArea.classList.toggle(cls);
        });
        showHideButton.classList.add('show-hide-button');
        buttonsArea.appendChild(showHideButton);

        this._gearPlanTable = new GearPlanTable(this, item => this.editorItem = item);
        this.showAdvancedStats = SETTINGS.viewDetailedStats ?? false;

        const sheetOptions = new DropdownActionMenu('More Actions...');

        const siFmt = formatSyncInfo(this.syncInfo, this.level);
        if (siFmt !== null) {
            const ilvlSyncBtn = makeActionButton(siFmt, () => {
                const modal = new ChangePropsModal(this);
                modal.attachAndShowExclusively();
            });
            buttonsArea.appendChild(ilvlSyncBtn);
        }

        if (!this.isViewOnly) {
            const addRowButton = makeActionButton([makeNewSheetIcon(), "New Set"], () => {
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
                label: 'Save As...',
                action: () => {
                    const modal = new SaveAsModal(this, newSheet => openSheetByKey(newSheet.saveKey));
                    modal.attachAndShowExclusively();
                },
            });
            if (this.saveKey) {
                sheetOptions.addAction({
                    label: 'Change Level/Job/Sync',
                    action: () => {
                        const modal = new ChangePropsModal(this);
                        modal.attachAndShowExclusively();
                    },
                });

            }
        }

        if (!this.isViewOnly) {

            const newSimButton = makeActionButton([makeNewSheetIcon(), "Add Sim"], () => {
                this.showAddSimDialog();
            });
            buttonsArea.appendChild(newSimButton);

            const exportSheetButton = makeActionButton([makeExportIcon(), "Export Sheet"], () => {
                startExport(this);
            });
            buttonsArea.appendChild(exportSheetButton);

            const importGearSetButton = makeActionButton([makeImportIcon(), "Import Sets"], () => {
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
            this.sendMessageToPopouts({'type': MESSAGE_REFRESH_CONTENT});
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
        const validSpecialStats: SpecialStatKey[] = [];
        const specialStat = this.applicableSpecialStat();
        if (specialStat) {
            validSpecialStats.push(specialStat);
        }
        if (this.activeSpecialStat && !validSpecialStats.includes(this.activeSpecialStat)) {
            validSpecialStats.push(specialStat);
        }
        if (validSpecialStats.length > 0) {
            this.specialStatDropdown = new FieldBoundDataSelect<GearPlanSheet, SpecialStatKey | null>(
                this,
                'activeSpecialStat',
                value => {
                    switch (value) {
                        case null:
                            return 'No Special Stats';
                        default:
                            return camel2title(value);
                    }
                },
                [null, ...validSpecialStats]
            );
            buttonsArea.appendChild(this.specialStatDropdown);
        }

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
            const advancedStats = makeActionButton('Stat Details', () => {
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


        const matFillCtrl = this.makeMateriaAutoFillController(() => this.selectedGearSet);
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
                const newHeightPx = initialHeight + delta;
                const newHeightPct = newHeightPx / document.body.clientHeight * 100;
                // The logic here is:
                // We want to use an exact pixel value if possible, to avoid the weird sub-pixel jumping that can be
                // seen when not using a 1:1 device pixel ratio.
                // However, the one thing the old way did better was that if you resized your window, the top part
                // would stay proportional to vertical screen size.
                // This gives us the best of both worlds - dragging will be correct, and you'll get automatic resize
                // when the window height changes, without any extra JS.
                const minVh = newHeightPct - 0.2;
                const maxVh = newHeightPct + 0.2;
                const newHeight = `clamp(${minVh}vh, ${newHeightPx}px, ${maxVh}vh)`;
                this.tableArea.style.minHeight = newHeight;
                this.tableArea.style.maxHeight = newHeight;
                this.tableArea.style.flexBasis = newHeight;
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
        // Kick off sim loading if it hasn't already
        ASYNC_SIM_LOADER.load();
        await super.load();
        this.setupRealGui();
    }

    async loadFromDataManager(dataManager: DataManager): Promise<void> {
        if (!this.isEmbed) {
            await ASYNC_SIM_LOADER.load();
        }
        return super.loadFromDataManager(dataManager);
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
            // Fast-path for gear set viewer specifically.
            // If ads are enabled, it would just make things slower to have to reload all the ads,
            // so just replace the specific dom element.
            if (node instanceof GearSetViewer && this.editorArea.querySelector('gear-set-viewer')) {
                const existingViewer = this.editorArea.querySelector('gear-set-viewer');
                existingViewer.replaceWith(node);
            }
            else {
                this.editorArea.replaceChildren(node);
            }
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

    makeMateriaAutoFillController(setGetter: () => CharacterGearSet | undefined) {
        const outer = this;

        function doSet(f: (set: CharacterGearSet) => void): void {
            const set = setGetter();
            if (set) {
                f(set);
                if (outer._editorAreaNode instanceof GearSetEditor) {
                    outer._editorAreaNode.refreshMateria();
                }
                outer.sendMessageToPopouts({'type': MESSAGE_REFRESH_CONTENT});
            }
        }

        return {
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

    sendMessageToSetPopout(set: CharacterGearSet, message: unknown) {
        this._openSetPopouts.get(set)?.postMessage(message);
    }

    sendMessageToPopouts(message: unknown) {
        this._openSetPopouts.forEach((win) => {
            if (!win.closed) {
                win.postMessage(message);
            }
        });
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
        if (set) {
            this.sendMessageToSetPopout(set, {'type': MESSAGE_REFRESH_CONTENT});
        }
        else {
            this.sendMessageToPopouts({'type': MESSAGE_REFRESH_CONTENT});
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
        this.sendMessageToPopouts({type: MESSAGE_REFRESH_TOOLBAR});
    }

    delGearSet(gearSet: CharacterGearSet) {
        // Close any open popout for this set before deleting it
        this.closePopoutForSet(gearSet);
        super.delGearSet(gearSet);
        if (this._gearPlanTable) {
            this._gearPlanTable.dataChanged();
            this._gearPlanTable.reprocessAllSimColColors();
        }
        // Clear editor if we deleted the currently selected set
        if (this._editorItem === gearSet) {
            this.editorItem = undefined;
        }
    }

    /**
     * Open or focus a popout window for the specified gear set.
     */
    openPopoutForSet(set: CharacterGearSet) {
        const index = this.sets.indexOf(set);
        if (index < 0) {
            return;
        }
        const existing = this._openSetPopouts.get(set);
        if (existing && !existing.closed) {
            try {
                existing.focus();
            }
            catch (e) {
                // ignore
            }
            return;
        }
        const url = makeUrlSimple(POPUP_HASH, index.toString());
        // Get rid of IntelliJ auto-reload because refreshing closes the popout anyway
        url.searchParams.delete('_ij_reload');
        const popup = window.open(url, getNextPopoutContext(), "popout,location=false,toolbar=false,status=false,width=1024,height=768");
        if (!popup) {
            alert('Failed to pop out editor. Your browser may be blocking popups.');
            return;
        }
        (popup as any).parentSheet = this;
        this._openSetPopouts.set(set, popup);
        // Immediately swap editor area to the placeholder if this set is currently selected
        if (this._editorItem === set) {
            this.refreshGearEditor(set);
        }
        // Cleanup when popup closes
        const interval = window.setInterval(() => {
            if (popup.closed) {
                window.clearInterval(interval);
                this._openSetPopouts.delete(set);
                if (this._editorItem === set) {
                    this.refreshGearEditor(set);
                }
            }
        }, 1000);
        try {
            popup.addEventListener('beforeunload', () => {
                window.clearInterval(interval);
                this._openSetPopouts.delete(set);
                if (this._editorItem === set) {
                    this.refreshGearEditor(set);
                }
            });
        }
        catch (e) {
            // Some browsers may not allow adding listeners across windows; rely on polling
        }
    }

    /**
     * Close an open popout for the specified set, if present.
     */
    closePopoutForSet(set: CharacterGearSet) {
        const w = this._openSetPopouts.get(set);
        if (w) {
            try {
                if (!w.closed) {
                    w.close();
                }
            }
            catch (e) {
                // ignore
            }
            this._openSetPopouts.delete(set);
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
                    history.pushState(null, null, cleanUrl(sheetUrl));
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

customElements.define("separator-editor", SeparatorEditor);
customElements.define("separator-viewer", SeparatorViewer);
customElements.define("gear-plan-table", GearPlanTable, {extends: "table"});
customElements.define("gear-plan", GearPlanSheetElement);
customElements.define("sim-result-display", SimResultMiniDisplay);
customElements.define("sim-result-detail-display", SimResultDetailDisplay);
