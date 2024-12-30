import {
    autoAttackModifier,
    autoDhitBonusDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg,
    hpScalar,
    mainStatMulti,
    mainStatPowerMod,
    mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    tenacityDmg,
    tenacityIncomingDmg,
    vitToHp,
    wdMulti
} from "@xivgear/xivmath/xivmath";
import {getClassJobStats, JOB_DATA, JobName, MAIN_STATS, STAT_ABBREVIATIONS} from "@xivgear/xivmath/xivconstants";
import {GeneralSettings, registerFormula} from "./math_main";
import {DataManager, makeDataManager} from "@xivgear/core/datamanager";
import {JobData, LevelStats} from "@xivgear/xivmath/geartypes";

type SksSettings = {
    baseGcd: number,
    sks: number,
    haste: number
}

type SpsSettings = {
    baseGcd: number,
    sps: number,
    haste: number
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

async function getClassJobStatsFull(job: JobName) {
    if (jobDataManager === undefined) {
        const dm = makeDataManager(job, 100);
        jobDataManager = dm.loadData().then(() => dm);
    }
    const multipliers = (await jobDataManager).multipliersForJob(job);
    return {
        ...getClassJobStats(job),
        jobStatMultipliers: multipliers,
    };
}

const baseMain = (generalSettings: GeneralSettings) => generalSettings.levelStats.baseMainStat;
const baseSub = (generalSettings: GeneralSettings) => generalSettings.levelStats.baseSubStat;

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
        functions: [{
            name: "Main Stat Multiplier",
            fn: mainStatMulti,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, getClassJobStats(gen.classJob), arg.mainstat];
            },
        }],
        variables: [{
            type: "number",
            label: "Main Stat Value",
            property: "mainstat",
            integer: true,
            min: baseMain,
        }],
        primaryVariable: "mainstat",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {mainstat: generalSettings.levelStats.baseMainStat};
        },
    });

    registerFormula<{
        'wd': number,
        'delay': number
    }>({
        name: "Weapon Damage",
        stub: "weapon-damage",
        functions: [{
            name: "Weapon Damage Multiplier",
            fn: wdMulti,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, await getClassJobStatsFull(gen.classJob), arg.wd];
            },
        }, {
            name: "Auto-Attack Multiplier",
            fn: autoAttackModifier,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, await getClassJobStatsFull(gen.classJob), arg.delay, arg.wd];
            },
        }],
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
        functions: [{
            name: "Determination Multiplier",
            fn: detDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.det];
            },
        }],
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
        'tnc': number
    }>({
        name: "Tenacity",
        stub: "tnc",
        functions: [{
            name: "Outgoing Multiplier",
            fn: tenacityDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.tnc];
            },
        }, {
            name: "Incoming Multiplier",
            fn: tenacityIncomingDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.tnc];
            },
        }],
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
        functions: [{
            name: "MP/3s",
            fn: mpTick,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.piety];
            },
        }],
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
            {
                name: 'GCD',
                fn: sksToGcd,
                argExtractor: async function (args, gen) {
                    return [args.baseGcd, gen.levelStats, args.sks, args.haste];
                },
            },
            {
                name: 'DoT Multi',
                fn: sksTickMulti,
                argExtractor: async function (args, gen) {
                    return [gen.levelStats, args.sks];
                },
            },
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
            {
                name: 'GCD',
                fn: spsToGcd,
                argExtractor: async function (args, gen) {
                    return [args.baseGcd, gen.levelStats, args.sps, args.haste];
                },
            },
            {
                name: 'DoT Multi',
                fn: spsTickMulti,
                argExtractor: async function (args, gen) {
                    return [gen.levelStats, args.sps];
                },
            },
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

    registerFormula<{
        crit: number,
    }>({
        name: "Crit",
        stub: "crit",
        functions: [{
            name: "Crit Chance",
            fn: critChance,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.crit];
            },
        }, {
            name: "Crit Damage",
            fn: critDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.crit];
            },
        }],
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
        'dhit': number
    }>({
        name: 'Direct Hit',
        stub: "dhit",
        functions: [{
            name: "DH Chance",
            fn: dhitChance,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.dhit];
            },
        }, {
            name: "DH Damage",
            fn: dhitDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.dhit];
            },
        }, {
            name: "Auto-DH Bonus",
            fn: autoDhitBonusDmg,
            argExtractor: async function (arg, gen: GeneralSettings) {
                return [gen.levelStats, arg.dhit];
            },
        }],
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
        functions: [{
            name: 'Hit Points',
            fn: vitToHp,
            async argExtractor(arg, gen: GeneralSettings): Promise<Parameters<typeof vitToHp>> {
                return [gen.levelStats, await getClassJobStatsFull(gen.classJob), arg.vit];
            },
        }],
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
        functions: [{
            name: 'baseMain',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.baseMainStat,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats];
            },
        }, {
            name: 'baseSub',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.baseSubStat,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats];
            },
        }, {
            name: 'levelDiv',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.levelDiv,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats];
            },
        }, {
            name: 'Base HP',
            excludeFormula: true,
            fn: (lvl: LevelStats) => lvl.hp,
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats];
            },
        }, {
            name: 'HP Mod',
            excludeFormula: true,
            fn: (lvl: LevelStats, jobStats: JobData) => hpScalar(lvl, jobStats),
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats, JOB_DATA[gen.classJob]];
            },
        }, {
            name: 'AP Mod',
            excludeFormula: true,
            fn: (lvl: LevelStats, jobStats: JobData) => mainStatPowerMod(lvl, jobStats),
            async argExtractor(arg, gen: GeneralSettings) {
                return [gen.levelStats, JOB_DATA[gen.classJob]];
            },

        }],
        makeDefaultInputs: (generalSettings: GeneralSettings) => {
            return {};
        },
        primaryVariable: 'level',
        variables: [],
    });
    registerFormula<Record<string, never>>({
        name: 'Jobs',
        stub: 'job',
        functions: [{
            name: 'AA Pot',
            excludeFormula: true,
            fn: (jobData: JobData) => jobData.aaPotency,
            async argExtractor(arg, gen: GeneralSettings) {
                const stats = await getClassJobStatsFull(gen.classJob);
                return [stats];
            },
        }, ...([...MAIN_STATS, 'hp'] as const).map(stat => {
            return {
                name: STAT_ABBREVIATIONS[stat],
                excludeFormula: true,
                fn: (jobData: JobData) => jobData.jobStatMultipliers[stat],
                async argExtractor(arg, gen: GeneralSettings) {
                    const stats = await getClassJobStatsFull(gen.classJob);
                    return [stats];
                },
            };
        })],
        makeDefaultInputs: (generalSettings: GeneralSettings) => {
            return {};
        },
        primaryVariable: 'job',
        variables: [],
    });
}

