import {getLevelStats} from "../xivconstants";
import {
    fl,
    sksToGcd,
} from "../xivmath";
import {assert} from "chai";
import {LevelStats} from "../geartypes";

export function sksToGcd_simplified(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    const commonPart1 = fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv);
    return fl((100 - haste) * ((baseGcd * (1000 - commonPart1)) / 1000)) / 100;
}

export function sksToGcd_newRounding(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    const commonPart1 = fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv);
    return fl((100 - haste) * fl((baseGcd * (1000 - commonPart1)) / 1000)) / 100;
}

// Not working
export function sksToGcd_etroOriginal(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    const commonPart1 = fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv);
    const arrow = 0,
        feyWind = 0,
        selfBuff2 = 0,
        RoF = 100,
        umbralAstral3 = 100;
    return (
        fl(
            (fl(
                    (fl(
                            (fl(
                                    ((1000 -
                                            fl(
                                                (130 * (sks - levelStats.baseSubStat)) / levelStats.levelDiv
                                            )) *
                                        baseGcd) /
                                    1000
                                ) *
                                fl(
                                    ((fl(
                                                (fl(((100 - arrow) * (100 - haste)) / 100) *
                                                    (100 - 0)) /
                                                100
                                            ) -
                                            feyWind) *
                                        (selfBuff2 - 100)) /
                                    100
                                )) /
                            -100
                        ) *
                        RoF) /
                    1000
                ) *
                umbralAstral3) /
            100
        ) / 100 // Added to taken func. Converts from MS to S.
    );
}

// Not working
export function sksToGcd_etroSimplified(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    const commonPart1 = fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv);
    return Math.floor(
        (Math.floor(
            (Math.floor(
                (Math.floor((baseGcd * (1000 - commonPart1) / 1000)) *
                    Math.floor((100 - haste) * -1)) / -100) * 100) / 1000) * 100) / 100) / 100;
}

export function sksToGcd_makarOriginal(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    return fl(fl(fl(fl((1000 - fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv)) * (baseGcd * 1000) / 1000) * fl((fl(fl((100 - 0) * (100 - 0) / 100) * (100 - haste) / 100) - 0) * (0 - 100) / 100) / -100) * 100 / 1000) * 100 / 100) / 100;
}

export function sksToGcd_makarSimplified(baseGcd: number, levelStats: LevelStats, sks: number, haste = 0): number {
    return fl(fl(fl((1000 - fl(130 * (sks - levelStats.baseSubStat) / levelStats.levelDiv)) * baseGcd) * (100 - haste)) / 1000) / 100;
}



type Result = {
    sks: number,
    haste: number,
    original: number,
    simplified: number,
    newRounding: number,
    etroOriginal: number,
    etroSimplified: number,
    makarOriginal: number,
    makarSimplified: number
}
describe('sks calc', () => {
    it('comparison', () => {
        const results: Result[] = [];
        const levelStats = getLevelStats(90);
        const baseSks = levelStats.baseSubStat;
        const baseGcd = 2.5;
        for (let sks = baseSks; sks < 1000; sks++) {
            for (let haste = 0; haste < 25; haste++) {
                results.push({
                    sks: sks,
                    haste: haste,
                    original: sksToGcd(baseGcd, levelStats, sks, haste),
                    simplified: sksToGcd_simplified(baseGcd, levelStats, sks, haste),
                    newRounding: sksToGcd_newRounding(baseGcd, levelStats, sks, haste),
                    etroOriginal: sksToGcd_etroOriginal(baseGcd, levelStats, sks, haste),
                    etroSimplified: sksToGcd_etroSimplified(baseGcd, levelStats, sks, haste),
                    makarOriginal: sksToGcd_makarOriginal(baseGcd, levelStats, sks, haste),
                    makarSimplified: sksToGcd_makarSimplified(baseGcd, levelStats, sks, haste),
                })
            }
        }
        const bad = results.filter(resultRow => {
            return (
                // false
                // || resultRow.original !== resultRow.simplified
                // || resultRow.original !== resultRow.newRounding
                // || resultRow.original !== resultRow.etroOriginal
                // || resultRow.original !== resultRow.etroSimplified
                resultRow.makarSimplified !== resultRow.makarOriginal
                || resultRow.makarSimplified !== resultRow.original
            )
        });
        bad.forEach(resultRow => {
            console.log(JSON.stringify(resultRow));
        });
        if (bad.length > 0) {
            assert.fail();
        }
    });
});