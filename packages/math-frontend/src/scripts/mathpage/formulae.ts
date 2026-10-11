import {
    autoAttackModifier,
    autoCritBuffDmg,
    autoDhitBonusDmg,
    critChance,
    critDmg,
    defIncomingDmg,
    detDmg,
    dhitChance,
    dhitDmg,
    flp,
    hpScalar,
    mainStatMulti,
    mainStatPowerMod,
    mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    statCapWithJob,
    tenacityDmg,
    tenacityIncomingDmg,
    vitToHp,
    wdMulti
} from "@xivgear/xivmath/xivmath";
import {
    getClassJobStats,
    JOB_DATA,
    JobName,
    LEVEL_ITEMS,
    MAIN_STATS,
    MAX_ILVL,
    STAT_ABBREVIATIONS,
    STAT_FULL_NAMES,
    SupportedLevel
} from "@xivgear/xivmath/xivconstants";
import {Func, GeneralSettings, MathFormula, registerFormula} from "./math_main";
import {DataManager, makeDataManager} from "@xivgear/core/datamanager";
import {JobData, LevelStats, OccGearSlotKey, OccGearSlots, RawStatKey} from "@xivgear/xivmath/geartypes";

type BaseSpeedSettings = {
    baseGcd: number,
    haste: number
}

type SksSettings = BaseSpeedSettings & {
    sks: number,
}

type SpsSettings = BaseSpeedSettings & {
    sps: number,
}

const baseGcdVar = {
    type: "number",
    label: "Base GCD",
    property: "baseGcd",
    integer: false,
    min: () => 0.1,
} as const;

const hasteVar = {
    type: "number",
    label: "Haste",
    property: "haste",
    integer: true,
    min: () => 0,
    max: () => 99,
} as const;

let jobDataManager: Promise<DataManager>;

async function getMathDataManager(job: JobName): Promise<DataManager> {
    if (jobDataManager === undefined) {
        const dm = makeDataManager([job], 100);
        jobDataManager = dm.loadData().then(() => dm);
    }
    return jobDataManager;
}

async function getClassJobStatsFull(job: JobName) {
    const multipliers = (await getMathDataManager(job)).multipliersForJob(job);
    return {
        ...getClassJobStats(job),
        jobStatMultipliers: multipliers,
    };
}

const baseMain = (generalSettings: GeneralSettings) => generalSettings.levelStats.baseMainStat;
const baseSub = (generalSettings: GeneralSettings) => generalSettings.levelStats.baseSubStat;

type IlvlSyncCapInputs = {
    ilvl: number,
    baseParam: RawStatKey,
    slot: OccGearSlotKey,
    meldParamIndex: number,
}

async function ilvlSyncCapArguments(arg: IlvlSyncCapInputs, gen: GeneralSettings): Promise<[number, number, number]> {
    const dm = await getMathDataManager(gen.classJob);
    const baseParamInfo = dm.baseParams[arg.baseParam];
    const meldParam = baseParamInfo?.meldParam[arg.meldParamIndex];
    const ilvlModifier = dm.getIlvlSyncInfo(arg.ilvl)?.getIlvlModifier(arg.baseParam);
    const baseParamSlotModifier = baseParamInfo?.slots[arg.slot];
    if (meldParam === undefined || ilvlModifier === undefined || baseParamSlotModifier === undefined) {
        return [0, 0, 0];
    }
    return [meldParam, ilvlModifier, baseParamSlotModifier];
}

function showMeldParam(meldParam: number, _ilvlModifier: number, _baseParamSlotModifier: number): number {
    return meldParam;
}

function showIlvlModifier(_meldParam: number, ilvlModifier: number, _baseParamSlotModifier: number): number {
    return ilvlModifier;
}

function showBaseParamSlotModifier(_meldParam: number, _ilvlModifier: number, baseParamSlotModifier: number): number {
    return baseParamSlotModifier;
}

const meldParamOptions = [
    {
        value: 0,
        label: 'General',
    },
    {
        value: 1,
        label: 'Fending',
    },
    {
        value: 2,
        label: 'Maiming',
    },
    {
        value: 3,
        label: 'Striking',
    },
    {
        value: 4,
        label: 'Aiming',
    },
    {
        value: 5,
        label: 'Casting',
    },
    {
        value: 6,
        label: 'Healing',
    },
    {
        value: 7,
        label: 'Special DoW',
    },
    {
        value: 8,
        label: 'Special DoM',
    },
    {
        value: 9,
        label: 'DoH/DoL',
    },
    {
        value: 10,
        label: 'Slaying',
    },
    {
        value: 11,
        label: 'Scouting',
    },
    {
        value: 12,
        label: 'Aiming Acc',
    },
] as const;

const baseParamOptions = (Object.keys(STAT_FULL_NAMES) as RawStatKey[])
    .filter(stat => stat !== 'gearHaste')
    .map(stat => ({
        label: STAT_FULL_NAMES[stat],
        value: stat,
    }));

const slotOptions = OccGearSlots.map(slot => ({
    label: slot,
    value: slot,
}));

/**
 * Formual "wrapper" (actually just a pass-through) to allow for internal type-consistency for function arguments
 *
 * @param formula The formula to wrap
 */
function formula<AllArgType, FuncType extends Func>(formula: MathFormula<AllArgType, FuncType>): MathFormula<AllArgType, Func> {
    return formula;
}

// TODO: baseDamageFull
// TODO: baseHealing
// TODO: social media previews
// TODO: custom levelStats/jobMultipliers
/**
 * Register the built-in formulae
 */
export function registerFormulae() {
    registerFormula<{
        'mainstat': number
    }>({
        name: "Main Stat",
        stub: "main-stat",
        functions: [formula({
            name: "Main Stat Multiplier",
            fn: mainStatMulti,
            argExtractor: async function (arg, gen: GeneralSettings) {
                // This one technically doesn't need this
                return [gen.levelStats, getClassJobStats(gen.classJob) as JobData, arg.mainstat] as const;
            },
        })],
        variables: [{
            type: "number",
            label: "Main Stat Value",
            property: "mainstat",
            integer: true,
            min: baseMain,
        }],
        primaryVariable:
            "mainstat",
        makeDefaultInputs(generalSettings
                          :
                          GeneralSettings
        ) {
            return {mainstat: generalSettings.levelStats.baseMainStat};
        }
        ,
    })
    ;


    registerFormula<{
        'wd': number,
        'delay': number
    }>({
        name: "Weapon Damage",
        stub: "weapon-damage",
        functions: [formula({
            name: "Weapon Damage Multiplier",
            fn: wdMulti,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, await getClassJobStatsFull(gen.classJob), arg.wd, false] as const;
            },
        }), formula({
            name: "Auto-Attack Multiplier",
            fn: autoAttackModifier,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, await getClassJobStatsFull(gen.classJob), arg.delay, arg.wd] as const;
            },
        })],
        variables: [{
            type: "number",
            label: "Weapon Damage Value",
            property: "wd",
            integer: true,
            min: () => 0,
        }, {
            type: "number",
            label: "Weapon Speed (Seconds)",
            property: "delay",
            integer: false,
            min: () => 0.01,
        }],
        primaryVariable: "wd",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {
                wd: 101,
                delay: 3.12,
            };
        },
    });

    registerFormula<{
        'det': number
    }>({
        name: "Determination",
        stub: "det",
        functions: [formula({
            name: "Determination Multiplier",
            fn: detDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.det] as const;
            },
        })],
        variables: [{
            type: "number",
            label: "Determination Stat",
            property: "det",
            integer: true,
            min: baseMain,
        }],
        primaryVariable: "det",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {det: generalSettings.levelStats.baseMainStat};
        },
    });

    registerFormula<{
        'def': number
    }>({
        name: "Defense",
        stub: "def",
        functions: [formula({
            name: "Defense/Mdef Damage Taken",
            fn: defIncomingDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.def] as const;
            },
        })],
        variables: [{
            type: "number",
            label: "Defense/Mdef Stat",
            property: "def",
            integer: true,
            min: () => 0,
        }],
        primaryVariable: "def",
        makeDefaultInputs() {
            return {def: 0};
        },
    });

    registerFormula<{
        'tnc': number
    }>({
        name: "Tenacity",
        stub: "tnc",
        functions: [formula({
            name: "Outgoing Multiplier",
            fn: tenacityDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.tnc] as const;
            },
        }), formula({
            name: "Incoming Multiplier",
            fn: tenacityIncomingDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.tnc] as const;
            },
        })],
        variables: [{
            type: "number",
            label: "Tenacity Stat",
            property: "tnc",
            integer: true,
            min: baseSub,
        }],
        primaryVariable: "tnc",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {tnc: generalSettings.levelStats.baseSubStat};
        },
    });

    registerFormula<{
        'piety': number
    }>({
        name: "Piety",
        stub: "piety",
        functions: [formula({
            name: "MP/3s",
            fn: mpTick,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.piety] as const;
            },
        })],
        variables: [{
            type: "number",
            label: "Piety Stat",
            property: "piety",
            integer: true,
            min: baseMain,
        }],
        primaryVariable: "piety",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {piety: generalSettings.levelStats.baseSubStat};
        },
    });

    registerFormula<SksSettings>({
        stub: 'sks',
        name: 'Skill Speed',
        functions: [
            formula({
                name: 'GCD',
                fn: sksToGcd,
                argExtractor: async function (args, gen) {
                    return [args.baseGcd, gen.levelStats, args.sks, args.haste] as const;
                },
            }),
            formula({
                name: 'DoT Multi',
                fn: sksTickMulti,
                hideableColumn: true,
                argExtractor: async function (args, gen) {
                    return [gen.levelStats, args.sks] as const;
                },
            }),
        ],
        variables: [
            baseGcdVar,
            {
                type: "number",
                label: "Skill Speed",
                property: "sks",
                integer: true,
                min: baseSub,
            },
            hasteVar,
        ],
        primaryVariable: 'sks',
        makeDefaultInputs: (gen) => {
            return {
                baseGcd: 2.5,
                sks: gen.levelStats.baseSubStat,
                haste: 0,
            };
        },
    });

    registerFormula<SpsSettings>({
        stub: 'sps',
        name: 'Spell Speed',
        primaryVariable: 'sps',
        functions: [
            formula({
                name: 'GCD',
                fn: spsToGcd,
                argExtractor: async function (args, gen) {
                    return [args.baseGcd, gen.levelStats, args.sps, args.haste] as const;
                },
            }),
            formula({
                name: 'DoT Multi',
                hideableColumn: true,
                fn: spsTickMulti,
                argExtractor: async function (args, gen) {
                    return [gen.levelStats, args.sps] as const;
                },
            }),
        ],
        variables: [
            baseGcdVar,
            {
                type: "number",
                label: "Spell Speed",
                property: "sps",
                integer: true,
                min: baseSub,
            },
            hasteVar,
        ],
        makeDefaultInputs: (gen: GeneralSettings) => {
            return {
                baseGcd: 2.5,
                sps: gen.levelStats.baseSubStat,
                haste: 0,
            };
        },
    });

    registerFormula<SpsSettings & {
        secondaryGcd: number,
        secondaryHaste: number,
    }>({
        stub: 'gcd-comp',
        name: 'GCD Comparison',
        primaryVariable: 'sps',
        functions: [
            formula({
                name: 'GCD 1',
                fn: spsToGcd,
                argExtractor: async function (args, gen) {
                    return [args.baseGcd, gen.levelStats, args.sps, args.haste] as const;
                },
            }),
            formula({
                name: 'GCD 2',
                excludeFormula: true,
                fn: spsToGcd,
                argExtractor: async function (args, gen) {
                    return [args.secondaryGcd, gen.levelStats, args.sps, args.secondaryHaste] as const;
                },
            }),
            formula({
                name: 'DoT Multi',
                hideableColumn: true,
                fn: spsTickMulti,
                argExtractor: async function (args, gen) {
                    return [gen.levelStats, args.sps] as const;
                },
            }),
        ],
        variables: [
            {
                ...baseGcdVar,
                label: 'Base GCD 1',
            },
            {
                ...baseGcdVar,
                property: 'secondaryGcd',
                label: 'Base GCD 2',
            },
            {
                type: "number",
                label: "SpS/SkS",
                property: "sps",
                integer: true,
                min: baseSub,
            },
            {
                ...hasteVar,
                label: 'Haste 1',
            },
            {
                ...hasteVar,
                property: 'secondaryHaste',
                label: 'Haste 2',
            },
        ],
        makeDefaultInputs: (gen: GeneralSettings) => {
            return {
                baseGcd: 2.5,
                secondaryGcd: 2.0,
                sps: gen.levelStats.baseSubStat,
                haste: 0,
                secondaryHaste: 0,
            };
        },
    });

    registerFormula<{
        crit: number,
    }>({
        name: "Crit",
        stub: "crit",
        functions: [formula({
            name: "Crit Chance",
            fn: critChance,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.crit] as const;
            },
        }), formula({
            name: "Crit Damage",
            fn: critDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.crit] as const;
            },
        })],
        makeDefaultInputs: (gen) => {
            return {
                crit: gen.levelStats.baseSubStat,
            };
        },
        primaryVariable: 'crit',
        variables: [{
            type: "number",
            label: "Crit Stat",
            property: "crit",
            integer: true,
            min: baseSub,
        }],
    });

    registerFormula<{
        crit: number,
        bonusPct: number,
    }>({
        name: "Bonus/Auto Crit",
        stub: "autocrit",
        functions: [
            formula({
                name: "Buffed Crit Chance",
                excludeFormula: true,
                fn: (critChance: number, bonusCritChance: number) => flp(3, critChance + bonusCritChance),
                argExtractor: async function (arg, gen: GeneralSettings) {
                    return [
                        critChance(gen.levelStats, arg.crit),
                        flp(2, arg.bonusPct / 100),
                    ] as const;
                },
            }),
            formula({
                name: "Autocrit Extra Multi",
                fn: autoCritBuffDmg,
                argExtractor: async function (arg, gen: GeneralSettings) {
                    const cmult = critDmg(gen.levelStats, arg.crit);
                    return [cmult, flp(2, arg.bonusPct / 100)] as const;
                },
            }),
            formula({
                name: "Autocrit Total Multi",
                fn: (cm: number, bcm: number) => flp(5, cm * bcm),
                excludeFormula: true,
                argExtractor: async function (arg, gen: GeneralSettings) {
                    const cmult = critDmg(gen.levelStats, arg.crit);
                    return [cmult, autoCritBuffDmg(cmult, arg.bonusPct / 100)] as const;
                },
            }),
        ],
        makeDefaultInputs: (gen) => {
            return {
                crit: gen.levelStats.baseSubStat,
                bonusPct: 10,
            };
        },
        primaryVariable: 'crit',
        variables: [{
            type: "number",
            label: "Crit Stat",
            property: "crit",
            integer: true,
            min: baseSub,
        }, {
            type: "number",
            label: "Crit % Buff",
            property: "bonusPct",
            integer: true,
            min: () => 0,
            max: () => 100,
        }],
    });

    registerFormula<{
        'dhit': number
    }>({
        name: 'Direct Hit',
        stub: "dhit",
        functions: [formula({
            name: "DH Chance",
            fn: dhitChance,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.dhit] as const;
            },
        }), formula({
            name: "DH Damage",
            fn: dhitDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.dhit] as const;
            },
        }), formula({
            name: "Auto-DH Bonus",
            fn: autoDhitBonusDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.dhit] as const;
            },
        })],
        makeDefaultInputs: (gen: GeneralSettings) => {
            return {dhit: gen.levelStats.baseSubStat};
        },
        primaryVariable: "dhit",
        variables: [{
            type: "number",
            label: "DH Stat",
            property: "dhit",
            integer: true,
            min: baseSub,
        }],
    });

    registerFormula<{
        'vit': number,
    }>({
        name: 'Vitality',
        stub: 'vit',
        functions: [formula({
            name: 'Hit Points',
            fn: vitToHp,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats, await getClassJobStatsFull(gen.classJob), arg.vit] as const;
            },
        })],
        makeDefaultInputs: (gen: GeneralSettings) => {
            return {vit: gen.levelStats.baseMainStat};
        },
        primaryVariable: 'vit',
        variables: [{
            type: 'number',
            label: 'Vitality',
            property: 'vit',
            integer: true,
            min: baseMain,
        }],
    });

    registerFormula<Record<string, never>>({
        name: 'Levels',
        stub: 'lvlmod',
        functions: [formula({
            name: 'baseMain',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.baseMainStat,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats] as const;
            },
        }), formula({
            name: 'baseSub',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.baseSubStat,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats] as const;
            },
        }), formula({
            name: 'levelDiv',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.levelDiv,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats] as const;
            },
        }), formula({
            name: 'Base HP',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.hp,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats] as const;
            },
        }), formula({
            name: 'HP Mod',
            excludeFormula: true,
            fn: hpScalar,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats, JOB_DATA[gen.classJob]] as const;
            },
        }), formula({
            name: 'AP Mod',
            excludeFormula: true,
            fn: mainStatPowerMod,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats, JOB_DATA[gen.classJob]] as const;
            },
        })],
        makeDefaultInputs: (generalSettings: GeneralSettings) => {
            return {};
        },
        primaryVariable: 'level',
        variables: [],
    });
    registerFormula<Record<string, never>>({
        name: 'Jobs',
        stub: 'job',
        functions: [formula({
            name: 'AA Pot',
            excludeFormula: true,
            fn: (jobData: JobData) => jobData.aaPotency,
            async argExtractor(arg, gen: GeneralSettings) {
                const stats = await getClassJobStatsFull(gen.classJob);
                return [stats] as const;
            },
        }), ...([...MAIN_STATS, 'hp'] as const).map(stat => {
            return formula({
                name: STAT_ABBREVIATIONS[stat],
                excludeFormula: true,
                fn: (jobData: JobData) => jobData.jobStatMultipliers[stat],
                async argExtractor(arg, gen: GeneralSettings) {
                    const stats = await getClassJobStatsFull(gen.classJob);
                    return [stats] as const;
                },
            });
        })],
        makeDefaultInputs: (generalSettings: GeneralSettings) => {
            return {};
        },
        primaryVariable: 'job',
        variables: [],
    });

    registerFormula<IlvlSyncCapInputs>({
        name: 'iLvl Sync Cap',
        stub: 'ilvl-sync-cap',
        maxDisplayEntries: 2000,
        functions: [formula({
            name: 'Stat Cap',
            fn: statCapWithJob,
            argExtractor: ilvlSyncCapArguments,
        }), formula({
            name: 'Meld Param',
            fn: showMeldParam,
            argExtractor: ilvlSyncCapArguments,
            excludeFormula: true,
        }), formula({
            name: 'Ilvl Slot Mod',
            fn: showIlvlModifier,
            argExtractor: ilvlSyncCapArguments,
            excludeFormula: true,
        }), formula({
            name: 'BaseParam Slot Mod',
            fn: showBaseParamSlotModifier,
            argExtractor: ilvlSyncCapArguments,
            excludeFormula: true,
        })],
        variables: [{
            type: 'number',
            label: 'iLvl',
            property: 'ilvl',
            integer: true,
            min: () => 1,
            max: () => MAX_ILVL,
        }, {
            type: 'select',
            label: 'BaseParam',
            property: 'baseParam',
            options: baseParamOptions,
            hideCol: true,
        }, {
            type: 'select',
            label: 'Gear Slot',
            property: 'slot',
            options: slotOptions,
            hideCol: true,
        }, {
            type: 'numberselect',
            label: 'Meld Param',
            property: 'meldParamIndex',
            options: meldParamOptions,
            includeValueInLabel: true,
            hideCol: true,
        }],
        primaryVariable: 'ilvl',
        makeDefaultInputs(generalSettings: GeneralSettings) {
            const level = generalSettings.levelStats.level as SupportedLevel;
            return {
                ilvl: LEVEL_ITEMS[level].defaultIlvlSync ?? LEVEL_ITEMS[level].defaultDisplaySettings.minILvl,
                baseParam: 'crit',
                slot: 'Body',
                meldParamIndex: 0,
            };
        },
    });
}
