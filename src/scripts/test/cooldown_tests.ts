import {CooldownTracker} from "../sims/common/cooldown_manager";
import {Ability, GcdAbility, OgcdAbility} from "../sims/sim_types";
import {Chain} from "../sims/buffs";
import * as assert from "assert";

const chain: OgcdAbility = {
    type: 'ogcd',
    name: "Chain",
    id: 7436,
    activatesBuffs: [Chain],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120
    }
}

const phlegma: GcdAbility = {
    type: 'gcd',
    name: "Phlegma",
    potency: 600,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    id: 24313,
    cooldown: {
        time: 40,
        // Mythical Phlegma VI where we get 3 charges
        charges: 3
    }
}

const reduced: OgcdAbility = {
    type: 'ogcd',
    name: "Special Chain",
    id: 7436,
    activatesBuffs: [Chain],
    potency: null,
    attackType: "Ability",
    cooldown: {
        // Set original time to 240, let it be reduced
        time: 240,
        reducedBy: "spellspeed"
    }
}

class FakeTimeSource {
    time: number = 0
}

describe('cooldown manager', () => {
    it('can handle a basic cooldown', () => {
        const ts = new FakeTimeSource();
        const tracker = new CooldownTracker(() => ts.time, 'reject');
        const ability = chain;
        // Check initial state
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 0,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 0,
                relative: 0
            },
            currentCharges: 1,
        });
        // Wait 5 seconds, should still be identical
        ts.time = 5.0;
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 5,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 5,
                relative: 0
            },
            currentCharges: 1,
        });
        // Use the CD
        tracker.useAbility(ability);
        // It is now on CD for 120 seconds
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 120
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 125,
                relative: 120
            },
            currentCharges: 0,
        });
        ts.time = 10
        // 5 seconds later, still on CD, but now 115 seconds remaining
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 115
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 125,
                relative: 115
            },
            currentCharges: 0,
        });
        // Almost done
        ts.time = 120
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 5
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 125,
                relative: 5
            },
            currentCharges: 0,
        });
        ts.time = 125
        // Now it's ready again
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 125,
                relative: 0
            },
            currentCharges: 1,
        });
        ts.time = 130
        // Still ready
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 130,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 130,
                relative: 0
            },
            currentCharges: 1,
        });
        // Use it again
        tracker.useAbility(ability);
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 250,
                relative: 120
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 250,
                relative: 120
            },
            currentCharges: 0,
        });
        ts.time = 140
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 250,
                relative: 110
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 250,
                relative: 110
            },
            currentCharges: 0,
        });
        ts.time = 250
        // Ready again
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 250,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 250,
                relative: 0
            },
            currentCharges: 1,
        });
        ts.time = 260
        // Still ready
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 260,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 260,
                relative: 0
            },
            currentCharges: 1,
        });
    });
    it('can handle a reduced cooldown', () => {
        const ts = new FakeTimeSource();
        const tracker = new CooldownTracker(() => ts.time, 'reject');
        const ability = reduced;
        // Check initial state
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 0,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 0,
                relative: 0
            },
            currentCharges: 1,
        });
        // Wait 5 seconds, should still be identical
        ts.time = 5.0;
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 5,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 5,
                relative: 0
            },
            currentCharges: 1,
        });
        // Use the CD
        tracker.useAbility(ability, 120);
        // It is now on CD for 120 seconds
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 120
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 125,
                relative: 120
            },
            currentCharges: 0,
        });
        ts.time = 10
        // 5 seconds later, still on CD, but now 115 seconds remaining
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 115
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 125,
                relative: 115
            },
            currentCharges: 0,
        });
        // Almost done
        ts.time = 120
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 5
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 125,
                relative: 5
            },
            currentCharges: 0,
        });
        ts.time = 125
        // Now it's ready again
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 125,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 125,
                relative: 0
            },
            currentCharges: 1,
        });
        ts.time = 130
        // Still ready
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 130,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 130,
                relative: 0
            },
            currentCharges: 1,
        });
        // Use it again, this time with 100s
        tracker.useAbility(ability, 100);
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 230,
                relative: 100
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 230,
                relative: 100
            },
            currentCharges: 0,
        });
        ts.time = 140
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 230,
                relative: 90
            },
            readyToUse: false,
            capped: false,
            cappedAt: {
                absolute: 230,
                relative: 90
            },
            currentCharges: 0,
        });
        ts.time = 230
        // Ready again
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 230,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 230,
                relative: 0
            },
            currentCharges: 1,
        });
        ts.time = 260
        // Still ready
        assert.deepEqual(tracker.statusOf(ability), {
            readyAt: {
                absolute: 260,
                relative: 0
            },
            readyToUse: true,
            capped: true,
            cappedAt: {
                absolute: 260,
                relative: 0
            },
            currentCharges: 1,
        });
    });
    it('can handle a charge-based cooldown', () => {
        const ts = new FakeTimeSource();
        const tracker = new CooldownTracker(() => ts.time, 'reject');
        const ability = phlegma;
        // Initial state
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: 0,
                relative: 0
            },
            capped: true,
            cappedAt: {
                absolute: 0,
                relative: 0
            },
            currentCharges: 3,
        });
        // Still fully charged
        ts.time = 10;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: 10,
                relative: 0
            },
            capped: true,
            cappedAt: {
                absolute: 10,
                relative: 0
            },
            currentCharges: 3,
        });
        // Use once
        tracker.useAbility(ability);
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: 10,
                relative: 0
            },
            capped: false,
            cappedAt: {
                absolute: 50,
                relative: 40
            },
            currentCharges: 2,
        });
        // Back to full
        ts.time = 50;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: ts.time,
                relative: 0
            },
            capped: true,
            cappedAt: {
                absolute: ts.time,
                relative: 0
            },
            currentCharges: 3,
        });
        // Still full
        ts.time = 60;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: ts.time,
                relative: 0
            },
            capped: true,
            cappedAt: {
                absolute: ts.time,
                relative: 0
            },
            currentCharges: 3,
        });
        // use ability several times in succession
        tracker.useAbility(ability);
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: ts.time,
                relative: 0
            },
            capped: false,
            cappedAt: {
                absolute: 60 + 40,
                relative: 40
            },
            currentCharges: 2,
        });
        ts.time += 1;
        tracker.useAbility(ability);
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: ts.time,
                relative: 0
            },
            capped: false,
            cappedAt: {
                absolute: 60 + 2 * 40,
                relative: 2 * 40 - 1
            },
            currentCharges: 1,
        });
        ts.time += 1;
        tracker.useAbility(ability);
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: false,
            readyAt: {
                absolute: 60 + 40,
                relative: 40 - 2
            },
            capped: false,
            cappedAt: {
                absolute: 60 + 3 * 40,
                relative: 3 * 40 - 2
            },
            currentCharges: 0,
        });
        ts.time = 99;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: false,
            readyAt: {
                absolute: 60 + 40,
                relative: 1
            },
            capped: false,
            cappedAt: {
                absolute: 60 + 3 * 40,
                relative: 81
            },
            currentCharges: 0,
        });
        ts.time = 100;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: 60 + 40,
                relative: 0
            },
            capped: false,
            cappedAt: {
                absolute: 60 + 3 * 40,
                relative: 80
            },
            currentCharges: 1,
        });
        ts.time = 140;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: ts.time,
                relative: 0
            },
            capped: false,
            cappedAt: {
                absolute: 60 + 3 * 40,
                relative: 40
            },
            currentCharges: 2,
        });
        ts.time = 180;
        assert.deepEqual(tracker.statusOf(ability), {
            readyToUse: true,
            readyAt: {
                absolute: ts.time,
                relative: 0
            },
            capped: true,
            cappedAt: {
                absolute: 60 + 3 * 40,
                relative: 0
            },
            currentCharges: 3,
        });
    });
});
