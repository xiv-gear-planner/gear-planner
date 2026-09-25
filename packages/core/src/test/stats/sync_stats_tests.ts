import {expect} from "chai";
import {HEADLESS_SHEET_PROVIDER} from "../../sheet";
import {CharacterGearSet} from "../../gear";
import {EquipSlotKey} from "@xivgear/xivmath/geartypes";
import {SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {statCapWithJob} from "@xivgear/xivmath/xivmath";

function equipById(set: CharacterGearSet, ...ids: number[]) {
    ids.forEach((id) => {
        const item = set.sheet.itemById(id);
        expect(item).to.not.be.undefined;
        expect(item).to.not.be.null;
        const rawSlot = item.displayGearSlotName;
        let actualSlot: EquipSlotKey;
        if (rawSlot === 'Ring') {
            if (set.equipment.RingRight) {
                actualSlot = 'RingLeft';
            }
            else {
                actualSlot = 'RingRight';
            }
        }
        else {
            actualSlot = rawSlot;
        }
        set.setEquip(actualSlot, item);
    });
}

describe('hp correctness', () => {
    async function prepSheet(level: SupportedLevel, itemIds: number[]): Promise<CharacterGearSet> {
        const sheet = HEADLESS_SHEET_PROVIDER.fromScratch("unused", "unused", 'BLU', level, undefined, false);
        await sheet.load();
        sheet.partyBonus = 0;
        sheet.race = 'Midlander';
        const set = new CharacterGearSet(sheet);
        equipById(set, ...itemIds);
        return set;
    }

    it('level 50 no gear', async () => {
        const set = await prepSheet(50, [24551]);
        const stats = set.computedStats;

        expect(stats.hp).to.eq(1470);
        expect(stats.vitality).to.eq(202);
    });
    it('level 60 no gear', async () => {
        const set = await prepSheet(60, [24551]);
        const stats = set.computedStats;

        expect(stats.hp).to.eq(1575);
        expect(stats.vitality).to.eq(218);
    });
    // TODO: 50/60 with native-level gear - not currently known to be broken on this branch but should be tested anyway
    it('level 50 synced i530 gear', async () => {
        const set = await prepSheet(50, [40345, 32330, 32553, 40348, 40349, 40350, 32562, 32567, 32572, 32577, 32355]);
        const stats = set.computedStats;

        expect(stats.hp).to.eq(5065);
        expect(stats.vitality).to.eq(523);
    });
    it('level 60 synced i530 gear', async () => {
        const set = await prepSheet(60, [40345, 32330, 32553, 40348, 40349, 40350, 32562, 32567, 32572, 32577, 32355]);
        const stats = set.computedStats;

        expect(stats.vitality).to.eq(784);
        expect(stats.hp).to.eq(8876);
        // > it's the head/hands/feet
        // > they are giving 56 vit each in-game
        /*
        https://v2.xivapi.com/api/sheet/ItemLevel/270
        Vitality = 736
        https://v2.xivapi.com/api/sheet/BaseParam/3
        Hands/Head/FeetPercent = 85
        MeldParam[5] = 90
        https://v2.xivapi.com/api/sheet/ClassJob/36
        ModifierVitality = 100
         */
    });
});

describe('stat cap tests', () => {
    // Verified in-game by Xi
    it('BLU 270 head VIT', () => {
        expect(statCapWithJob(90, 736, 85)).to.eq(56);
    });

    // Verified in-game by Wynn
    it('BLU 270 earring Crit', () => {
        expect(statCapWithJob(100, 685, 67)).to.eq(46);
    });

    it('BLU 270 earring VIT', () => {
        expect(statCapWithJob(90, 736, 67)).to.eq(44);
    });

    it('RDM 530 head VIT', () => {
        // 530 item has 122 vit
        // 600 item synced down gives us 123? tested in game
        expect(statCapWithJob(90, 1603, 85)).to.eq(123);
    });

    it('270 proto ultima neck', () => {
        // Proto Ultima Amulet of Healing has 46 big piety, and the melding UI shows that as the stat cap.
        expect(statCapWithJob(100, 685, 67)).to.eq(46);
    });

});


