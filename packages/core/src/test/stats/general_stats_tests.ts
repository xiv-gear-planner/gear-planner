import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {RawStats} from "@xivgear/xivmath/geartypes";
import {getLevelStats} from "@xivgear/xivmath/xivconstants";
import {expect} from "chai";
import {applyDhCritFull, baseDamageFull, fl} from "@xivgear/xivmath/xivmath";
import { multiplyFixed } from "@xivgear/xivmath/deviation";
import { HEADLESS_SHEET_PROVIDER } from "../../sheet";


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
            weaponDelay: 3.12,
        }), {}, level, getLevelStats(level), job, fakeSheet.classJobStats, 0, "The Lost");
        expect(stats.aaDelay).to.eq(3.12);
        expect(stats.aaMulti).to.eq(1.87);
        expect(stats.aaStatMulti).to.eq(0.77);
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
        expect(stats.wdMulti).to.eq(1.91);
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
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {
            vitality: {
                max: 203,
                percentage: 10,
            },
            crit: {
                max: 132,
                percentage: 10,
            },
            spellspeed: {
                max: 79,
                percentage: 10,
            },
        }, level, getLevelStats(level), job, fakeSheet.classJobStats, 0, "The Lost");
        expect(stats.aaDelay).to.eq(3.12);
        expect(stats.aaMulti).to.eq(1.87);
        expect(stats.aaStatMulti).to.eq(0.77);
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
        expect(stats.wdMulti).to.eq(1.91);
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
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {
            vitality: {
                max: 203,
                percentage: 10,
            },
            crit: {
                max: 132,
                percentage: 10,
            },
            spellspeed: {
                max: 79,
                percentage: 10,
            },
        }, level, getLevelStats(level), job, fakeSheet.classJobStats, 5, "The Lost");
        expect(stats.aaDelay).to.eq(3.12);
        expect(stats.aaMulti).to.eq(1.87);
        expect(stats.aaStatMulti).to.eq(0.87);
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
        expect(stats.wdMulti).to.eq(1.91);
        expect(stats.wdPhys).to.eq(141);
        expect(stats.weaponDelay).to.eq(3.12);
    }).timeout(30_000);
});

describe("Dmg/100p for known values", () => {
    // https://docs.google.com/spreadsheets/d/1yy11-m_iWaKs8zccrjunLELEGHCDSE3YNQkhx-E_tkk/edit?gid=1658055958#gid=1658055958
    const fakeSheetSMN = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'SMN', level, undefined);
    const loadPromiseSMN = fakeSheetSMN.load();
    const fakeSheetSCH = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'SCH', level, undefined);
    const loadPromiseSCH = fakeSheetSCH.load();
    const fakeSheetWAR = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'WAR', level, undefined);
    const loadPromiseWAR = fakeSheetWAR.load();
    const fakeSheetGNB = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'GNB', level, undefined);
    const loadPromiseGNB = fakeSheetGNB.load();
    it('SMN test 1', async () => {
        await loadPromiseSMN;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 1038,
            mind: 4448,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 812,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 1134,
            wdPhys: 114,
            wdMag: 114,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'SMN', fakeSheetSMN.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 100, 'Spell', false, false);
        expect(dmg100p.expected).to.eq(913);
        expect(stats.detMulti).to.eq(1.018);
        expect(stats.determination).to.eq(812);
        expect(stats.mainStatMulti).to.eq(4.22);
        expect(stats.wdMag).to.eq(114);
        expect(stats.wdPhys).to.eq(114);
        expect(stats.wdMulti).to.eq(1.64);
    });

    it('SMN test 2', async () => {
        await loadPromiseSMN;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 1167,
            mind: 4448,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 900,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 1134,
            wdPhys: 114,
            wdMag: 114,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'SMN', fakeSheetSMN.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 100, 'Spell', false, false);
        expect(dmg100p.expected).to.eq(1069);
        expect(stats.detMulti).to.eq(1.023);
        expect(stats.determination).to.eq(900);
        expect(stats.mainStatMulti).to.eq(4.91);
        expect(stats.wdMag).to.eq(114);
        expect(stats.wdPhys).to.eq(114);
        expect(stats.wdMulti).to.eq(1.64);
    });

    it('WAR test 1', async () => {
        await loadPromiseWAR;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1012,
            dexterity: 440,
            intelligence: 1167,
            mind: 4448,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 699,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 1134,
            wdPhys: 141,
            wdMag: 141,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'WAR', fakeSheetWAR.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 100, 'Weaponskill', false, false);
        expect(dmg100p.expected).to.eq(656);
        expect(stats.mainStatValue).to.eq(1012);
        expect(stats.detMulti).to.eq(1.013);
        expect(stats.determination).to.eq(699);
        expect(stats.mainStatMulti).to.eq(3.47);
        expect(stats.wdMag).to.eq(141);
        expect(stats.wdPhys).to.eq(141);
        expect(stats.wdMulti).to.eq(1.87);
    });
    it('WAR test 2', async () => {
        await loadPromiseWAR;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1069,
            dexterity: 440,
            intelligence: 1167,
            mind: 4448,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 739,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 1134,
            wdPhys: 141,
            wdMag: 141,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'WAR', fakeSheetWAR.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 100, 'Weaponskill', false, false);
        expect(dmg100p.expected).to.eq(703);
        expect(stats.mainStatValue).to.eq(1069);
        expect(stats.detMulti).to.eq(1.015);
        expect(stats.determination).to.eq(739);
        expect(stats.mainStatMulti).to.eq(3.71);
        expect(stats.wdMag).to.eq(141);
        expect(stats.wdPhys).to.eq(141);
        expect(stats.wdMulti).to.eq(1.87);
    });

    it('SCH test 0', async () => {
        await loadPromiseSCH;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 440,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 420,
            wdPhys: 0,
            wdMag: 0,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'SCH', fakeSheetSCH.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 75, 'Spell', false, true);
        expect(dmg100p.expected).to.eq(467);
        expect(stats.determination).to.eq(440);
        expect(stats.detMulti).to.eq(1.0);
        expect(stats.spellspeed).to.eq(420);
        expect(stats.spsDotMulti).to.eq(1.0);
        expect(stats.mainStatMulti).to.eq(9.72);
        expect(stats.wdMag).to.eq(0);
        expect(stats.wdPhys).to.eq(0);
        expect(stats.wdMulti).to.eq(0.50);
    });

    it('SCH test 1', async () => {
        await loadPromiseSCH;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 440,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 780,
            wdPhys: 0,
            wdMag: 0,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'SCH', fakeSheetSCH.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 75, 'Spell', false, true);
        expect(dmg100p.expected).to.eq(474);
        expect(stats.determination).to.eq(440);
        expect(stats.detMulti).to.eq(1.0);
        expect(stats.spellspeed).to.eq(780);
        expect(stats.spsDotMulti).to.eq(1.016);
        expect(stats.mainStatMulti).to.eq(9.72);
        expect(stats.wdMag).to.eq(0);
        expect(stats.wdPhys).to.eq(0);
        expect(stats.wdMulti).to.eq(0.50);
    });

    it('SCH test 2', async () => {
        await loadPromiseSCH;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 440,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 816,
            wdPhys: 0,
            wdMag: 0,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'SCH', fakeSheetSCH.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 75, 'Spell', false, true);
        expect(dmg100p.expected).to.eq(475);
        expect(stats.determination).to.eq(440);
        expect(stats.detMulti).to.eq(1.0);
        expect(stats.spellspeed).to.eq(816);
        expect(stats.spsDotMulti).to.eq(1.018);
        expect(stats.mainStatMulti).to.eq(9.72);
        expect(stats.wdMag).to.eq(0);
        expect(stats.wdPhys).to.eq(0);
        expect(stats.wdMulti).to.eq(0.50);
    });

    it('SCH test 3', async () => {
        await loadPromiseSCH;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: fl(440 * 0.9),
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 440,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 852,
            wdPhys: 0,
            wdMag: 0,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'SCH', fakeSheetSCH.classJobStats, 0, "The Lost");
        const dmg100p = baseDamageFull(stats, 75, 'Spell', false, true);
        expect(dmg100p.expected).to.eq(476);
        expect(stats.determination).to.eq(440);
        expect(stats.detMulti).to.eq(1.0);
        expect(stats.spellspeed).to.eq(852);
        expect(stats.spsDotMulti).to.eq(1.02);
        expect(stats.mainStatMulti).to.eq(9.72);
        expect(stats.wdMag).to.eq(0);
        expect(stats.wdPhys).to.eq(0);
        expect(stats.wdMulti).to.eq(0.50);
    });

    it('GNB Test 1', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1371,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 987,
            tenacity: 420,
            skillspeed: 420,
            spellspeed: 852,
            wdPhys: 79,
            wdMag: 79,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(987);
        expect(stats.detMulti).to.eq(1.027);
        expect(stats.skillspeed).to.eq(420);
        expect(stats.sksDotMulti).to.eq(1.0);
        expect(stats.mainStatMulti).to.eq(5.02);
        expect(stats.wdMag).to.eq(79);
        expect(stats.wdPhys).to.eq(79);
        expect(stats.wdMulti).to.eq(1.23);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(381);
    });

    it('GNB Test 2', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1371,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 987,
            tenacity: 420,
            skillspeed: 456,
            spellspeed: 852,
            wdPhys: 79,
            wdMag: 79,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(987);
        expect(stats.detMulti).to.eq(1.027);
        expect(stats.skillspeed).to.eq(456);
        expect(stats.sksDotMulti).to.eq(1.001);
        expect(stats.mainStatMulti).to.eq(5.02);
        expect(stats.wdMag).to.eq(79);
        expect(stats.wdPhys).to.eq(79);
        expect(stats.wdMulti).to.eq(1.23);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(381);
    });

    it('GNB Test 3', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1371,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 987,
            tenacity: 420,
            skillspeed: 492,
            spellspeed: 852,
            wdPhys: 79,
            wdMag: 79,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(987);
        expect(stats.detMulti).to.eq(1.027);
        expect(stats.skillspeed).to.eq(492);
        expect(stats.sksDotMulti).to.eq(1.003);
        expect(stats.mainStatMulti).to.eq(5.02);
        expect(stats.wdMag).to.eq(79);
        expect(stats.wdPhys).to.eq(79);
        expect(stats.wdMulti).to.eq(1.23);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(382);
    });

    it('GNB Test 4', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1371,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 987,
            tenacity: 420,
            skillspeed: 564,
            spellspeed: 852,
            wdPhys: 79,
            wdMag: 79,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(987);
        expect(stats.detMulti).to.eq(1.027);
        expect(stats.skillspeed).to.eq(564);
        expect(stats.sksDotMulti).to.eq(1.006);
        expect(stats.mainStatMulti).to.eq(5.02);
        expect(stats.wdMag).to.eq(79);
        expect(stats.wdPhys).to.eq(79);
        expect(stats.wdMulti).to.eq(1.23);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(383);
    });

    it('GNB Test 5', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1606,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 1113,
            tenacity: 420,
            skillspeed: 456,
            spellspeed: 852,
            wdPhys: 79,
            wdMag: 79,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(1113);
        expect(stats.detMulti).to.eq(1.033);
        expect(stats.skillspeed).to.eq(456);
        expect(stats.sksDotMulti).to.eq(1.001);
        expect(stats.mainStatMulti).to.eq(6.03);
        expect(stats.wdMag).to.eq(79);
        expect(stats.wdPhys).to.eq(79);
        expect(stats.wdMulti).to.eq(1.23);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(458);
    });

    it('GNB Test 6', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 1606,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 1113,
            tenacity: 420,
            skillspeed: 600,
            spellspeed: 852,
            wdPhys: 79,
            wdMag: 79,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(1113);
        expect(stats.detMulti).to.eq(1.033);
        expect(stats.skillspeed).to.eq(600);
        expect(stats.sksDotMulti).to.eq(1.008);
        expect(stats.mainStatMulti).to.eq(6.03);
        expect(stats.wdMag).to.eq(79);
        expect(stats.wdPhys).to.eq(79);
        expect(stats.wdMulti).to.eq(1.23);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(461);
    });
    it('GNB Test 7', async () => {
        await loadPromiseGNB;
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 2620,
            dexterity: 440,
            intelligence: 1038,
            mind: 2060,
            piety: 564,
            crit: 2988,
            dhit: 690,
            determination: 1667,
            tenacity: 420,
            skillspeed: 492,
            spellspeed: 852,
            wdPhys: 132,
            wdMag: 132,
            weaponDelay: 3.12,
        }),
        // Pineapple Orange Jelly
        {}, level, getLevelStats(level), 'GNB', fakeSheetGNB.classJobStats, 0, "The Lost");
        expect(stats.determination).to.eq(1667);
        expect(stats.detMulti).to.eq(1.061);
        expect(stats.skillspeed).to.eq(492);
        expect(stats.sksDotMulti).to.eq(1.003);
        expect(stats.mainStatMulti).to.eq(10.41);
        expect(stats.wdMag).to.eq(132);
        expect(stats.wdPhys).to.eq(132);
        expect(stats.wdMulti).to.eq(1.76);
        const dmg100p = baseDamageFull(stats, 60, 'Weaponskill', false, true);
        expect(dmg100p.expected).to.eq(1169);
    });
});

describe("Final damage values for known values", () => {
    const fakeSheetDRK = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'DRK', level, undefined);
    const loadPromiseDRK = fakeSheetDRK.load();
    const fakeSheetWAR = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'WAR', level, undefined);
    const loadPromiseWAR = fakeSheetWAR.load();
    it('WAR test autocrit/dh', async () => {
        await loadPromiseWAR;
        // Values taken from https://xivgear.app/?page=sl%7C730195d3-a9ee-4d29-a868-67cf5d613b0a
        // i.e. 7.1 BiS for Warrior.
        const stats = finalizeStats(new RawStats({
            hp: 0,
            vitality: 4119,
            strength: 4839,
            dexterity: 440,
            intelligence: 1167,
            mind: 4448,
            piety: 564,
            crit: 3253,
            dhit: 1176,
            determination: 2525,
            tenacity: 868,
            skillspeed: 420,
            spellspeed: 1134,
            wdPhys: 146,
            wdMag: 146,
            weaponDelay: 3.12,
        }),
        {}, level, getLevelStats(level), 'WAR', fakeSheetWAR.classJobStats, 0, "The Lost");
        const fellCleavePotency = 580;
        const dmg100p = baseDamageFull(stats, fellCleavePotency, 'Weaponskill', true, false);
        expect(dmg100p.expected).to.eq(25898);
        expect(stats.mainStatValue).to.eq(4839);
        expect(stats.detMulti).to.eq(1.105);
        expect(stats.determination).to.eq(2525);
        expect(stats.mainStatMulti).to.eq(19.99);
        expect(stats.wdMag).to.eq(146);
        expect(stats.wdPhys).to.eq(146);
        expect(stats.wdMulti).to.eq(1.92);
        expect(stats.autoDhBonus).to.eq(0.038);
        const modifiedStats = stats.withModifications((stats, bonuses) => {
            bonuses.forceCrit = true;
            bonuses.forceDh = true;
        });
        const afterCritDh = applyDhCritFull(dmg100p, modifiedStats, true, true);
        expect(afterCritDh).to.not.undefined;
        expect(afterCritDh.expected).to.eq(51893.1175);
        expect(fl(afterCritDh.stdDev)).to.eq(1498);
        const surgingTempestMod = 1.1;
        const finalDamage = multiplyFixed(afterCritDh, surgingTempestMod);
        expect(finalDamage).to.not.undefined;
        expect(finalDamage.expected).to.eq(57082.42925000001);
        expect(fl(finalDamage.stdDev)).to.eq(1647);
    });
    it('Dark Knight known value scaling', async () => {
        await loadPromiseDRK;
        const stats = finalizeStats(new RawStats({
            hp: 9822,
            vitality: 494,
            strength: 471,
            dexterity: 415,
            intelligence: 261,
            mind: 179,
            piety: 440,
            crit: 420,
            dhit: 420,
            determination: 440,
            tenacity: 420,
            skillspeed: 430,
            spellspeed: 420,
            wdPhys: 36,
            wdMag: 36,
            weaponDelay: 2.96,
        }),
        {}, level, getLevelStats(level), 'DRK', fakeSheetDRK.classJobStats, 0, "The Lost");


        // These match up with observed values.

        // 300 Potency is Hard Slash at level 100
        const damageBeforeCrit300Potency = baseDamageFull(stats, 300, 'Ability', false, false);
        expect(damageBeforeCrit300Potency.expected).to.eq(277);

        // 460 Potency is Edge of Shadow at level 100
        const damageBeforeCrit460 = baseDamageFull(stats, 460, 'Ability', false, false);
        expect(damageBeforeCrit460.expected).to.eq(425);

        // 580 Potency is Bloodspiller at level 100
        const damageBeforeCrit580 = baseDamageFull(stats, 580, 'Ability', false, false);
        expect(damageBeforeCrit580.expected).to.eq(537);
    });
    it('Dark Knight Living Shadow known value scaling', async () => {
        await loadPromiseDRK;
        const stats = finalizeStats(new RawStats({
            hp: 9822,
            vitality: 494,
            strength: 471,
            dexterity: 415,
            intelligence: 261,
            mind: 179,
            piety: 440,
            crit: 420,
            dhit: 420,
            determination: 440,
            tenacity: 420,
            skillspeed: 430,
            spellspeed: 420,
            wdPhys: 36,
            wdMag: 36,
            weaponDelay: 2.96,
        }),
        {}, level, getLevelStats(level), 'DRK', fakeSheetDRK.classJobStats, 0, "The Lost");
        expect(stats.mainStatValue).to.eq(471);
        // Seekers of the Sun have a +2 bonus, like Living Shadow. The Lost have +3.
        expect(stats.livingShadowStrength).to.eq(470);
        expect(stats.determination).to.eq(440);
        expect(stats.wdMag).to.eq(36);
        expect(stats.wdPhys).to.eq(36);
        expect(stats.mainStatMultiLivingShadow).to.eq(1.14);

        // These match up with observed values.

        // 420 potency Living Shadow Attack
        const damageBeforeCrit420 = baseDamageFull(stats, 420, 'Ability', false, false, "Living Shadow");
        expect(damageBeforeCrit420.expected).to.eq(344);

        // 620 potency Living Shadow Attack
        const damageBeforeCrit620 = baseDamageFull(stats, 620, 'Ability', false, false, "Living Shadow");
        expect(damageBeforeCrit620.expected).to.eq(508);

    });
});
