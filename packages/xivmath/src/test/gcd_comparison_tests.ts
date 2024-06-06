import {getLevelStats} from "../xivconstants";
import {
    sksToGcd,
    sksToGcd_etroOriginal,
    sksToGcd_etroSimplified,
    sksToGcd_newRounding,
    sksToGcd_simplified
} from "../xivmath";
import {assert} from "chai";

type Result = {
    sks: number,
    haste: number,
    original: number,
    simplified: number,
    newRounding: number,
    etroOriginal: number,
    etroSimplified: number
}
describe('sks calc', () => {
    it('comparison', () => {
        const results: Result[] = [];
        const levelStats = getLevelStats(90);
        const baseSks = levelStats.baseSubStat;
        const baseGcd = 2.5;
        for (let sks = baseSks; sks < 1000; sks++) {
            for (let haste = 0; haste < 20; haste++) {
                results.push({
                    sks: sks,
                    haste: haste,
                    original: sksToGcd(baseGcd, levelStats, sks, haste),
                    simplified: sksToGcd_simplified(baseGcd, levelStats, sks, haste),
                    newRounding: sksToGcd_newRounding(baseGcd, levelStats, sks, haste),
                    etroOriginal: sksToGcd_etroOriginal(baseGcd, levelStats, sks, haste),
                    etroSimplified: sksToGcd_etroSimplified(baseGcd, levelStats, sks, haste),
                })
            }
        }
        const bad = results.filter(resultRow => {
            return resultRow.original !== resultRow.simplified
                || resultRow.original !== resultRow.newRounding
                // || resultRow.original !== resultRow.etroOriginal
                // || resultRow.original !== resultRow.etroSimplified
        });
        bad.forEach(resultRow => {
            console.log(JSON.stringify(resultRow));
        });
        if (bad.length > 0) {
            assert.fail();
        }
    });
});