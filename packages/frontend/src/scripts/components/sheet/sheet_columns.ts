import {el, makeActionButton} from "@xivgear/common-ui/components/util";
import {CustomColumn, CustomColumnSpec, CustomRow, RefreshableRow, col} from "@xivgear/common-ui/table/tables";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {CharacterGearSet} from "@xivgear/core/gear";
import {ChanceStat, ComputedSetStats, MultiplierMitStat, MultiplierStat, RawStatKey} from "@xivgear/xivmath/geartypes";
import {getClassJobStats, STAT_ABBREVIATIONS, STAT_FULL_NAMES} from "@xivgear/xivmath/xivconstants";
import {capitalizeFirstLetter, toRelPct} from "@xivgear/util/strutils";
import {confirmDelete} from "@xivgear/common-ui/components/delete_confirm";
import {makeCopyIcon, makeTrashIcon} from "@xivgear/common-ui/components/icons";
import {installDragHelper} from "../../util/draghelpers";
import {FramelessJobIcon} from "../job/job_icon";
import {textWithToolTip} from "../../util/text_utils";
import {SimulationGui} from "../../sims/simulation_gui";
import {SimCurrentResult, SimResult, SimSettings} from "@xivgear/core/sims/sim_types";
import {iconForIssues} from "./gear_set_issues";

export type SheetOptionalColumnKey = 'defense' | 'magicDefense';

type MitigationStatDisplay = {
    stat: number;
    incomingMulti: number;
};

const noSeparators = (set: CharacterGearSet) => !set.isSeparator;

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
    const leftSpan = el('span', {}, [stats.stat.toString()]);
    const rightSpan = el('span', {class: 'extra-stat-info'}, [`(x${stats.multiplier.toFixed(3)})`]);
    return el('div', {class: 'multiplier-stat-display'}, [leftSpan, rightSpan]);
}

function chanceStatDisplay(stats: ChanceStat) {
    const leftSpan = el('span', {}, [stats.stat.toString()]);
    const rightSpan = el('span', {class: 'extra-stat-info'}, [`(${(stats.chance * 100.0).toFixed(1)}%x${stats.multiplier.toFixed(3)})`]);
    return el('div', {class: 'chance-stat-display'}, [leftSpan, rightSpan]);
}

function multiplierMitStatDisplay(stats: MultiplierMitStat) {
    const leftSpan = el('span', {}, [stats.stat.toString()]);
    const rightSpan = el('span', {class: 'extra-stat-info'}, [`(x${stats.multiplier.toFixed(3)}, ${toRelPct(stats.incomingMulti - 1, 1)}%)`]);
    return el('div', {class: 'multiplier-mit-stat-display'}, [leftSpan, rightSpan]);
}

function mitigationStatDisplay(stats: MitigationStatDisplay) {
    const leftSpan = el('span', {}, [stats.stat.toString()]);
    const rightSpan = el('span', {class: 'extra-stat-info'}, [`(${toRelPct(stats.incomingMulti - 1, 1)}%)`]);
    return el('div', {classes: ['multiplier-stat-display', 'mitigation-stat-display']}, [leftSpan, rightSpan]);
}

export type SheetOptionalColumn = Readonly<{
    key: SheetOptionalColumnKey;
    label: string;
    columnSpec: CustomColumnSpec<CharacterGearSet, MitigationStatDisplay>;
}>;

export type SheetOptionalColumnSelection = SheetOptionalColumn & {
    show: boolean;
};

export const SHEET_OPTIONAL_COLUMNS: Readonly<Record<SheetOptionalColumnKey, SheetOptionalColumn>> = {
    defense: {
        key: 'defense',
        label: 'Defense',
        columnSpec: {
            shortName: 'defense',
            displayName: 'Def',
            getter: gearSet => ({
                stat: gearSet.computedStats.defensePhys,
                incomingMulti: gearSet.computedStats.defenseDamageTaken,
            }),
            renderer: mitigationStatDisplay,
            extraClasses: ['stat-col', 'multiplier-mit-stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
        },
    },
    magicDefense: {
        key: 'magicDefense',
        label: 'Magic Defense',
        columnSpec: {
            shortName: 'magic-defense',
            displayName: 'M.Def',
            getter: gearSet => ({
                stat: gearSet.computedStats.defenseMag,
                incomingMulti: gearSet.computedStats.magicDefenseDamageTaken,
            }),
            renderer: mitigationStatDisplay,
            extraClasses: ['stat-col', 'multiplier-mit-stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
        },
    },
} as const;

export function isSheetOptionalColumnKey(key: string): key is SheetOptionalColumnKey {
    return Object.prototype.hasOwnProperty.call(SHEET_OPTIONAL_COLUMNS, key);
}

export type SheetColumnContext = {
    sheet: GearPlanSheet;
    table: HTMLElement & { _rows: RefreshableRow<CharacterGearSet>[] };
    simGuis: SimulationGui<SimResult, SimSettings, unknown>[];
    additionalColumns: SheetOptionalColumnSelection[];
    cloneGearSet: (gearSet: CharacterGearSet) => void;
    renderSimResult: (simGui: SimulationGui<SimResult, SimSettings, unknown>, result: SimCurrentResult<SimResult>) => Node;
};

export function createSheetColumns(context: SheetColumnContext): (CustomColumn<CharacterGearSet, unknown, unknown> | CustomColumnSpec<CharacterGearSet, unknown, unknown>)[] {
    const {sheet, table, simGuis} = context;
    const viewOnly = sheet.isViewOnly;
    const statColWidth = 40;
    const jobData = getClassJobStats(sheet.classJobName);

    const gcdColumns: (CustomColumn<CharacterGearSet, unknown, unknown> | CustomColumnSpec<CharacterGearSet, unknown, unknown>)[] = [];
    const override = jobData.gcdDisplayOverrides?.(sheet.level);
    if (override) {
        let counter = 0;
        for (const gcdOver of override) {
            gcdColumns.push(col({
                shortName: 'gcd-custom-' + counter++,
                displayName: gcdOver.shortLabel,
                getter: gearSet => {
                    const haste = gearSet.computedStats.haste(gcdOver.attackType, gcdOver.buffHaste ?? 0, gcdOver.gaugeHaste ?? 0);
                    switch (gcdOver.basis) {
                        case 'sks':
                            return gearSet.computedStats.gcdPhys(2.5, haste);
                        case 'sps':
                            return gearSet.computedStats.gcdMag(2.5, haste);
                        default:
                            return null;
                    }
                },
                rowCondition: noSeparators,
                renderer: gcd => el('span', {}, [gcd.toFixed(2)]),
                initialWidth: statColWidth + 10,
            }));
        }
    }
    else {
        gcdColumns.push(col({
            shortName: 'gcd',
            displayName: 'GCD',
            getter: gearSet => {
                const magHaste = gearSet.computedStats.haste('Spell', 0, 0);
                const physHaste = gearSet.computedStats.haste('Weaponskill', 0, 0);
                return Math.min(gearSet.computedStats.gcdMag(2.5, magHaste), gearSet.computedStats.gcdPhys(2.5, physHaste));
            },
            renderer: gcd => el('span', {}, [gcd.toFixed(2)]),
            rowCondition: noSeparators,
            initialWidth: statColWidth + 10,
        }));
    }

    const simColumns: CustomColumnSpec<CharacterGearSet, SimCurrentResult, SimulationGui<SimResult, SimSettings, unknown>>[] = simGuis.map(simGui => ({
        dataValue: simGui,
        shortName: 'sim-col-' + simGui.sim.shortName,
        get displayName() {
            return simGui.sim.displayName;
        },
        getter: gearSet => sheet.getSimResult(simGui.sim, gearSet),
        renderer: result => context.renderSimResult(simGui, result),
        colStyler: (value, colElement) => {
            colElement.classList.add('hoverable');
        },
        allowHeaderSelection: true,
        allowCellSelection: true,
        headerStyler: (value, colHeader) => {
            if (!colHeader.querySelector('.header-cell-gear')) {
                const span = el('span', {classes: ['header-cell-detail', 'header-cell-gear']}, ['⛭']);
                colHeader.firstElementChild?.appendChild(span);
            }
            colHeader.classList.add('hoverable');
            colHeader.title = 'Click to configure simulation settings';
        },
        rowCondition: noSeparators,
    }));

    const isCombat = sheet.classJobEarlyStats.type === 'Combat';

    function simpleStat(stat: RawStatKey, overrides: Partial<CustomColumnSpec<CharacterGearSet, unknown>> = {}): CustomColumn<CharacterGearSet, unknown, unknown> {
        return col({
            shortName: stat,
            displayName: STAT_FULL_NAMES[stat] ?? stat,
            getter: gearSet => gearSet.computedStats[stat],
            initialWidth: statColWidth,
            condition: () => sheet.isStatRelevant(stat),
            rowCondition: noSeparators,
            extraClasses: ['stat-col'],
            ...overrides,
        });
    }

    return [
        {
            shortName: 'actions',
            displayName: '',
            getter: gearSet => gearSet,
            renderer: (gearSet: CharacterGearSet) => {
                const div = el('div');
                div.appendChild(makeActionButton([makeTrashIcon()], ev => {
                    if (confirmDelete(ev, `Delete gear set '${gearSet.name}'?`)) {
                        sheet.delGearSet(gearSet);
                    }
                }, 'Delete this set'));
                div.appendChild(makeActionButton([makeCopyIcon()], () => context.cloneGearSet(gearSet), 'Clone this set'));
                const dragger = el('button', {class: 'drag-handle', title: 'Drag to re-order this set'}, ['≡']);
                let rowBeingDragged: null | CustomRow<CharacterGearSet> = null;
                let lastDelta = 0;
                installDragHelper({
                    dragHandle: dragger,
                    dragOuter: table,
                    downHandler: ev => {
                        let target = ev.target;
                        while (target) {
                            if (target instanceof CustomRow) {
                                console.log('Drag start: ' + target);
                                rowBeingDragged = target;
                                rowBeingDragged.classList.add('dragging');
                                return;
                            }
                            else if (target instanceof Node) {
                                target = target.parentElement as EventTarget;
                            }
                            else {
                                break;
                            }
                        }
                        rowBeingDragged = null;
                    },
                    moveHandler: ev => {
                        const dragY = ev.clientY;
                        const target = table._rows.find(row => {
                            const element = row.element;
                            if (!element || element === rowBeingDragged) {
                                return false;
                            }
                            const rect = element.getBoundingClientRect();
                            return rect.y <= dragY && dragY <= rect.y + rect.height;
                        });
                        if (target instanceof CustomRow) {
                            sheet.reorderSet(gearSet, sheet.sets.indexOf(target.dataItem));
                        }
                        if (rowBeingDragged) {
                            const rect = rowBeingDragged.getBoundingClientRect();
                            lastDelta = ev.pageY - (rect.y - lastDelta) - rect.height / 2;
                            rowBeingDragged.style.top = `${lastDelta}px`;
                        }
                    },
                    upHandler: () => {
                        sheet.requestSave();
                        lastDelta = 0;
                        if (rowBeingDragged) {
                            rowBeingDragged.style.top = '';
                            rowBeingDragged.classList.remove('dragging');
                        }
                        console.log('Drag end');
                        rowBeingDragged = null;
                    },
                });
                div.appendChild(dragger);
                return div;
            },
        },
        {
            shortName: 'setname',
            displayName: 'Set Name',
            getter: gearSet => gearSet,
            renderer: (value: CharacterGearSet) => {
                const nameSpan = el('span');
                const elements: Element[] = [nameSpan];
                if (value.name.trim().length === 0 && (value.description === undefined || value.description.trim().length === 0)) {
                    nameSpan.textContent = '\xa0';
                }
                else {
                    nameSpan.textContent = value.name;
                }
                const trimmedDesc = value.description?.trim();
                let title = value.name;
                if (viewOnly) {
                    const descSpan = el('span');
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
                if (!value.isSeparator && sheet.isMultiJob) {
                    const jobIcon = new FramelessJobIcon(value.job);
                    jobIcon.style.display = 'inline';
                    nameSpan.prepend(jobIcon);
                }
                const div = el('div', {class: 'set-name-desc-holder'}, elements);
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
            shortName: 'wd',
            displayName: 'WD',
            getter: gearSet => ({
                stat: Math.max(gearSet.computedStats.wdMag, gearSet.computedStats.wdPhys),
                multiplier: gearSet.computedStats.wdMulti,
            }),
            initialWidth: statColWidth,
            renderer: multiplierStatTooltip,
            extraClasses: ['stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
            condition: () => isCombat,
        } as CustomColumnSpec<CharacterGearSet, MultiplierStat>,
        {
            shortName: 'hp',
            displayName: 'HP',
            getter: gearSet => gearSet.computedStats.hp,
            extraClasses: ['stat-col', 'stat-col-hp', 'stat-col-less-important'],
            rowCondition: noSeparators,
            condition: () => isCombat,
        },
        {...mainStatCol(sheet, 'dexterity'), shortName: 'dex'},
        mainStatCol(sheet, 'strength'),
        mainStatCol(sheet, 'mind'),
        {...mainStatCol(sheet, 'intelligence'), shortName: 'int'},
        {
            shortName: 'crit',
            displayName: 'CRT',
            getter: gearSet => ({
                stat: gearSet.computedStats.crit,
                chance: gearSet.computedStats.critChance,
                multiplier: gearSet.computedStats.critMulti,
            }) as ChanceStat,
            renderer: chanceStatDisplay,
            condition: () => sheet.isStatRelevant('crit'),
            extraClasses: ['stat-col', 'chance-stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
        },
        {
            shortName: 'dhit',
            displayName: 'DHT',
            getter: gearSet => ({
                stat: gearSet.computedStats.dhit,
                chance: gearSet.computedStats.dhitChance,
                multiplier: gearSet.computedStats.dhitMulti,
            }) as ChanceStat,
            renderer: chanceStatDisplay,
            condition: () => sheet.isStatRelevant('dhit'),
            extraClasses: ['stat-col', 'chance-stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
        },
        {
            shortName: 'det',
            displayName: 'DET',
            getter: gearSet => ({
                stat: gearSet.computedStats.determination,
                multiplier: gearSet.computedStats.detMulti,
            }) as MultiplierStat,
            renderer: multiplierStatDisplay,
            condition: () => sheet.isStatRelevant('determination'),
            extraClasses: ['stat-col', 'multiplier-stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
        },
        {...tooltipMultiStatCol(sheet, 'skillspeed', 'sksDotMulti'), shortName: 'sks', displayName: 'SKS'},
        {...tooltipMultiStatCol(sheet, 'spellspeed', 'spsDotMulti'), shortName: 'sps', displayName: 'SPS'},
        col({
            shortName: 'piety',
            displayName: 'PIE',
            getter: gearSet => gearSet.computedStats.piety,
            initialWidth: statColWidth,
            condition: () => sheet.isStatRelevant('piety'),
            rowCondition: noSeparators,
            extraClasses: ['stat-col-less-important'],
        }),
        col({
            shortName: 'tenacity',
            displayName: 'TNC',
            getter: gearSet => ({
                stat: gearSet.computedStats.tenacity,
                multiplier: gearSet.computedStats.tncMulti,
                incomingMulti: gearSet.computedStats.tncIncomingMulti,
            }) satisfies MultiplierMitStat,
            renderer: multiplierMitStatDisplay,
            condition: () => sheet.isStatRelevant('tenacity'),
            extraClasses: ['stat-col', 'multiplier-mit-stat-col', 'stat-col-less-important'],
            rowCondition: noSeparators,
            initialWidth: viewOnly ? undefined : 110,
        }),
        simpleStat('cp', {displayName: 'CP'}),
        simpleStat('control', {displayName: 'Ctrl.'}),
        simpleStat('craftsmanship', {displayName: 'Cms.'}),
        simpleStat('gp', {displayName: 'GP'}),
        simpleStat('gathering', {initialWidth: 80}),
        simpleStat('perception', {initialWidth: 80}),
        ...context.additionalColumns.filter(column => column.show).map(column => ({
            ...column.columnSpec,
            initialWidth: viewOnly ? undefined : 110,
        })),
    ];
}
