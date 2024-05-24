import 'global-jsdom/register'
import 'isomorphic-fetch'
import {DataManager} from "../datamanager";
import * as assert from "assert";
import {RawStats} from "@xivgear/xivmath/geartypes";

function eq<T>(actual: T, expected: T) {
    assert.equal(actual, expected);
}
function deq<T>(actual: T, expected: T) {
    assert.deepEqual(actual, expected);
}

describe('Datamanager', () => {
    it('can load some SCH items', async () => {
        const dm = new DataManager('SCH', 90);
        await dm.loadData();
        const codexOfAscension = dm.itemById(40176);
        // Basic item props
        eq(codexOfAscension.id, 40176);
        eq(codexOfAscension.name, 'Codex of Ascension');
        // TODO: fix the extra / ?
        eq(codexOfAscension.iconUrl.toString(), 'https://xivapi.com//i/033000/033387_hr1.png');

        // XivCombatItem props
        deq(codexOfAscension.stats, new RawStats({
            wdPhys: 132,
            wdMag: 132,
            mind: 416,
            crit: 306,
            determination: 214,
            vitality: 412,
            weaponDelay: 3.12
        }));

        // GearItem props
        eq(codexOfAscension.displayGearSlotName, 'Weapon');
        eq(codexOfAscension.occGearSlotName, 'Weapon2H');
        eq(codexOfAscension.ilvl, 665);
        eq(codexOfAscension.primarySubstat, 'crit');
        eq(codexOfAscension.secondarySubstat, 'determination');

        deq(codexOfAscension.statCaps, {
            // Primary stats
            strength: 416,
            dexterity: 416,
            intelligence: 416,
            mind: 416,

            // Substats
            crit: 306,
            determination: 306,
            dhit: 306,
            piety: 306,
            skillspeed: 306,
            spellspeed: 306,
            tenacity: 306,

            // Other
            wdMag: 132,
            wdPhys: 132,
            weaponDelay: NaN, // TODO: ?
            vitality: 412,
            hp: 0
        });
        eq(codexOfAscension.materiaSlots.length, 2);
        eq(codexOfAscension.isCustomRelic, false);
        // Not synced down - "Unsynced version" should just be the same
        eq(codexOfAscension.unsyncedVersion, codexOfAscension);
        eq(codexOfAscension.isUnique, true);
        eq(codexOfAscension.acquisitionType, 'raid');
        eq(codexOfAscension.relicStatModel, undefined);

        // This item should be filtered out due to being too low of an ilvl
        const ilvl545book = dm.itemById(34691);
        eq(ilvl545book, undefined);

        // This item is 560, it just barely makes it
        const ilvl560book = dm.itemById(34053);
        eq(ilvl560book.ilvl, 560);

    }).timeout(20_000);
});