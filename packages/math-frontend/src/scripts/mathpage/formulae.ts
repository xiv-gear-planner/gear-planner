import {
    autoDhBonusDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg,
    mainStatMulti,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    tenacityDmg,
} from "@xivgear/xivmath/xivmath";
import {getClassJobStats, getLevelStats} from "@xivgear/xivmath/xivconstants";
import {GeneralSettings, registerFormula} from "./math_main";

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
    min: 0.1
} as const;

const hasteVar = {
    type: "number",
    label: "Haste",
    property: "haste",
    integer: true,
    min: 0,
    max: 99
} as const;

// TODO: baseDamageFull
// TODO: baseHealing
// TODO: piety
// TODO: fix weapon damage
// TODO: get comments out of the formulae
// TODO: better landing page
// TODO: social media previews
export function registerFormulae() {
    registerFormula<{
        'mainstat': number
    }>({
        name: "Main Stat",
        stub: "main-stat",
        functions: [{
            name: "Main Stat Multiplier",
            fn: mainStatMulti,
            argExtractor: function (arg, gen: GeneralSettings) {
                return [gen.levelStats, getClassJobStats(gen.classJob), arg.mainstat];
            }
        }],
        variables: [{
            type: "number",
            label: "Main Stat Value",
            property: "mainstat",
            integer: true,
            min: 1
        }],
        primaryVariable: "mainstat",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {mainstat: generalSettings.levelStats.baseMainStat};
        },
    });

    // TODO: WD requires job multipliers data from xivapi
    // registerFormula<{
    //     'wd': number,
    //     'delay': number
    // }>({
    //     name: "Weapon Damage",
    //     stub: "weapon-damage",
    //     functions: [{
    //         name: "Weapon Damage Multiplier",
    //         fn: wdMulti,
    //         argExtractor: (arg, gen: GeneralSettings) => {
    //             return [gen.levelStats, getClassJobStats(gen.classJob), arg.wd];
    //         }
    //     }, {
    //         name: "Auto-Attack Multiplier",
    //         fn: autoAttackModifier,
    //         argExtractor: (arg, gen: GeneralSettings) => {
    //             return [gen.levelStats, getClassJobStats(gen.classJob), arg.delay, arg.wd];
    //         }
    //     }],
    //     variables: [{
    //         type: "number",
    //         label: "Weapon Damage Value",
    //         property: "wd",
    //         integer: true,
    //         min: 0
    //     }, {
    //         type: "number",
    //         label: "Weapon Speed (Seconds)",
    //         property: "delay",
    //         integer: false,
    //         min: 1
    //     }],
    //     primaryVariable: "wd",
    //     makeDefaultInputs(generalSettings: GeneralSettings) {
    //         return {wd: 0, delay: 3000};
    //     },
    // });

    registerFormula<{
        'det': number
    }>({
        name: "Determination",
        stub: "det",
        functions: [{
            name: "Determination Multiplier",
            fn: detDmg,
            argExtractor: (arg, gen: GeneralSettings) => {
                return [gen.levelStats, arg.det];
            }
        }],
        variables: [{
            type: "number",
            label: "Determination Stat",
            property: "det",
            integer: true,
            min: 1
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
            name: "Tenacity Damage Multiplier",
            fn: tenacityDmg,
            argExtractor: (arg, gen: GeneralSettings) => {
                return [gen.levelStats, arg.tnc];
            }
        }],
        variables: [{
            type: "number",
            label: "Tenacity Stat",
            property: "tnc",
            integer: true,
            min: 1
        }],
        primaryVariable: "tnc",
        makeDefaultInputs(generalSettings: GeneralSettings) {
            return {tnc: generalSettings.levelStats.baseSubStat};
        },
    });

    registerFormula<SksSettings>({
        stub: 'sks',
        name: 'Skill Speed',
        functions: [
            {
                name: 'GCD',
                fn: sksToGcd,
                argExtractor: (args, gen) => {
                    return [args.baseGcd, gen.levelStats, args.sks, args.haste]
                },
            },
            {
                name: 'DoT Multi',
                fn: sksTickMulti,
                argExtractor: (args, gen) => {
                    return [gen.levelStats, args.sks]
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
                min: 1
            },
            hasteVar
        ],
        primaryVariable: 'sks',
        makeDefaultInputs: (gen) => {
            return {
                baseGcd: 2.5,
                sks: gen.levelStats.baseSubStat,
                haste: 0
            }
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
                argExtractor: (args, gen) => {
                    return [args.baseGcd, gen.levelStats, args.sps, args.haste]
                },
            },
            {
                name: 'DoT Multi',
                fn: spsTickMulti,
                argExtractor: (args, gen) => {
                    return [gen.levelStats, args.sps]
                },
            },
        ],
        variables: [
            baseGcdVar,
            {
                type: "number",
                label: "Skill Speed",
                property: "sps",
                integer: true,
                min: 1
            },
            hasteVar
        ],
        makeDefaultInputs: () => {
            return {
                baseGcd: 2.5,
                sps: getLevelStats(90).baseSubStat,
                haste: 0
            }
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
            argExtractor: (arg: {
                crit: number;
            }, gen: GeneralSettings): unknown[] => [gen.levelStats, arg.crit]
        }, {
            name: "Crit Damage",
            fn: critDmg,
            argExtractor: (arg: {
                crit: number;
            }, gen: GeneralSettings): unknown[] => [gen.levelStats, arg.crit]
        }],
        makeDefaultInputs: (gen) => {
            return {
                crit: gen.levelStats.baseSubStat
            }
        },
        primaryVariable: 'crit',
        variables: [{
            type: "number",
            label: "Crit Stat",
            property: "crit",
            integer: true,
            min: 1
        }]
    });

    registerFormula<{
        'dhit': number
    }>({
        name: 'Direct Hit',
        stub: "dhit",
        functions: [{
            name: "DH Chance",
            fn: dhitChance,
            argExtractor: (arg, gen: GeneralSettings): unknown[] => [gen.levelStats, arg.dhit]
        }, {
            name: "DH Damage",
            fn: dhitDmg,
            argExtractor: (arg, gen: GeneralSettings): unknown[] => [gen.levelStats, arg.dhit]
        }, {
            name: "Auto-DH Bonus",
            fn: autoDhBonusDmg,
            argExtractor: (arg, gen: GeneralSettings): unknown[] => [gen.levelStats, arg.dhit]
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
            min: 1
        }]
    });
}

