import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {RawStats} from "@xivgear/xivmath/geartypes";
import {getLevelStats} from "@xivgear/xivmath/xivconstants";
import {HEADLESS_SHEET_PROVIDER} from "../sheet";
import {expect} from "chai";
import {fl} from "@xivgear/xivmath/xivmath";


const level = 100;
const job = 'SCH';
const fakeSheet = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", job, level, undefined);

const loadPromise = fakeSheet.load();

// TODO: make a version of these tests that uses live items
describe("ComputedSetStats", () => {
    // from https://xivgear.app/?page=sl%7C159ef597-02ed-4fc9-9290-5de6c16c3af9
    it('computes correctly with no food and no party bonus', async () => {
        await loadPromise;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 462,
            mind: 4448,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 2706,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 1134,
            wdPhys: 141,
            wdMag: 141,
            weaponDelay: 3.12
        }), {}, level, getLevelStats(level), job, fakeSheet.classJobStats, 0);
        expect(stats.aaDelay).to.eq(3.12);
        expect(stats.aaMulti).to.eq(187.2);
        expect(stats.aaStatMulti).to.eq(0.76);
        expect(stats.autoDhBonus).to.eq(0.013);
        expect(stats.crit).to.eq(2988);
        expect(stats.critChance).to.eq(0.234);
        expect(stats.critMulti).to.eq(1.584);
        expect(stats.detMulti).to.eq(1.114);
        expect(stats.determination).to.eq(2706);
        expect(stats.dexterity).to.eq(440);
        expect(stats.dhit).to.eq(690);
        expect(stats.dhitChance).to.eq(0.053);
        expect(stats.dhitMulti).to.eq(1.25);
        expect(stats.gcdMag(2.50)).to.eq(2.41);
        expect(stats.gcdPhys(2.50)).to.eq(2.50);
        expect(stats.haste('Spell')).to.eq(0);
        expect(stats.hp).to.eq(114937);
        expect(stats.intelligence).to.eq(462);
        expect(stats.mainStatMulti).to.eq(22.58);
        expect(stats.mind).to.eq(4448);
        expect(stats.mpPerTick).to.eq(206);
        expect(stats.piety).to.eq(564);
        expect(stats.skillspeed).to.eq(420);
        expect(stats.sksDotMulti).to.eq(1);
        expect(stats.spellspeed).to.eq(1134);
        expect(stats.spsDotMulti).to.eq(1.033);
        expect(stats.strength).to.eq(396);
        expect(stats.tenacity).to.eq(420);
        expect(stats.tncIncomingMulti).to.eq(1);
        expect(stats.tncMulti).to.eq(1);
        expect(stats.vitality).to.eq(4119);
        expect(stats.wdMag).to.eq(141);
        expect(stats.wdMulti).to.eq(191);
        expect(stats.wdPhys).to.eq(141);
        expect(stats.weaponDelay).to.eq(3.12);
    }).timeout(30_000);
    it('computes correctly with food and no party bonus', async () => {
        await loadPromise;
        const stats = finalizeStats(new RawStats({
                hp: 0,
                vitality: 4119,
                strength: fl(440 * 0.9),
                dexterity: 440,
                intelligence: 462,
                mind: 4448,
                piety: 564,
                crit: 2988,
                dhit: 690,
                determination: 2706,
                tenacity: 420,
                skillspeed: 420,
                spellspeed: 1134,
                wdPhys: 141,
                wdMag: 141,
                weaponDelay: 3.12
            }),
            // Pineapple Orange Jelly
            {
                vitality: {
                    max: 203,
                    percentage: 10
                },
                crit: {
                    max: 132,
                    percentage: 10,
                },
                spellspeed: {
                    max: 79,
                    percentage: 10
                }
            }, level, getLevelStats(level), job, fakeSheet.classJobStats, 0);
        expect(stats.aaDelay).to.eq(3.12);
        expect(stats.aaMulti).to.eq(187.2);
        expect(stats.aaStatMulti).to.eq(0.76);
        expect(stats.autoDhBonus).to.eq(0.013);
        expect(stats.crit).to.eq(2988 + 132);
        expect(stats.critChance).to.eq(0.244);
        expect(stats.critMulti).to.eq(1.594);
        expect(stats.detMulti).to.eq(1.114);
        expect(stats.determination).to.eq(2706);
        expect(stats.dexterity).to.eq(440);
        expect(stats.dhit).to.eq(690);
        expect(stats.dhitChance).to.eq(0.053);
        expect(stats.dhitMulti).to.eq(1.25);
        expect(stats.gcdMag(2.50)).to.eq(2.40);
        expect(stats.gcdPhys(2.50)).to.eq(2.50);
        expect(stats.haste('Spell')).to.eq(0);
        expect(stats.hp).to.eq(121048);
        expect(stats.intelligence).to.eq(462);
        expect(stats.mainStatMulti).to.eq(22.58);
        expect(stats.mind).to.eq(4448);
        expect(stats.mpPerTick).to.eq(206);
        expect(stats.piety).to.eq(564);
        expect(stats.skillspeed).to.eq(420);
        expect(stats.sksDotMulti).to.eq(1);
        expect(stats.spellspeed).to.eq(1134 + 79);
        expect(stats.spsDotMulti).to.eq(1.037);
        expect(stats.strength).to.eq(396);
        expect(stats.tenacity).to.eq(420);
        expect(stats.tncIncomingMulti).to.eq(1);
        expect(stats.tncMulti).to.eq(1);
        expect(stats.vitality).to.eq(4119 + 203);
        expect(stats.wdMag).to.eq(141);
        expect(stats.wdMulti).to.eq(191);
        expect(stats.wdPhys).to.eq(141);
        expect(stats.weaponDelay).to.eq(3.12);
    }).timeout(30_000);
    it('computes correctly with food and with party bonus', async () => {
        await loadPromise;
        const stats = finalizeStats(new RawStats({
                hp: 0,
                vitality: 4119,
                strength: fl(440 * 0.9),
                dexterity: 440,
                intelligence: 462,
                mind: 4448,
                piety: 564,
                crit: 2988,
                dhit: 690,
                determination: 2706,
                tenacity: 420,
                skillspeed: 420,
                spellspeed: 1134,
                wdPhys: 141,
                wdMag: 141,
                weaponDelay: 3.12
            }),
            // Pineapple Orange Jelly
            {
                vitality: {
                    max: 203,
                    percentage: 10
                },
                crit: {
                    max: 132,
                    percentage: 10,
                },
                spellspeed: {
                    max: 79,
                    percentage: 10
                }
            }, level, getLevelStats(level), job, fakeSheet.classJobStats, 5);
        expect(stats.aaDelay).to.eq(3.12);
        expect(stats.aaMulti).to.eq(187.2);
        expect(stats.aaStatMulti).to.eq(0.86);
        expect(stats.autoDhBonus).to.eq(0.013);
        expect(stats.crit).to.eq(2988 + 132);
        expect(stats.critChance).to.eq(0.244);
        expect(stats.critMulti).to.eq(1.594);
        expect(stats.detMulti).to.eq(1.114);
        expect(stats.determination).to.eq(2706);
        expect(stats.dexterity).to.eq(440);
        expect(stats.dhit).to.eq(690);
        expect(stats.dhitChance).to.eq(0.053);
        expect(stats.dhitMulti).to.eq(1.25);
        expect(stats.gcdMag(2.50)).to.eq(2.40);
        expect(stats.gcdPhys(2.50)).to.eq(2.50);
        expect(stats.haste('Spell')).to.eq(0);
        expect(stats.hp).to.eq(127218);
        expect(stats.intelligence).to.eq(462);
        expect(stats.mainStatMulti).to.eq(23.78);
        expect(stats.mind).to.eq(4670);
        expect(stats.mpPerTick).to.eq(206);
        expect(stats.piety).to.eq(564);
        expect(stats.skillspeed).to.eq(420);
        expect(stats.sksDotMulti).to.eq(1);
        expect(stats.spellspeed).to.eq(1134 + 79);
        expect(stats.spsDotMulti).to.eq(1.037);
        expect(stats.strength).to.eq(415);
        expect(stats.tenacity).to.eq(420);
        expect(stats.tncIncomingMulti).to.eq(1);
        expect(stats.tncMulti).to.eq(1);
        expect(stats.vitality).to.eq(4527); // Base * Party + Food
        expect(stats.wdMag).to.eq(141);
        expect(stats.wdMulti).to.eq(191);
        expect(stats.wdPhys).to.eq(141);
        expect(stats.weaponDelay).to.eq(3.12);
    }).timeout(30_000);
});