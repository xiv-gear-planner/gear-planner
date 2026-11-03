import {describe, it} from "mocha";
import {expect} from "chai";
import {CharacterGearSet} from "@xivgear/core/gear";
import {JobMultipliers, RawStats} from "@xivgear/xivmath/geartypes";
import {getClassJobStats, getLevelStats, getRaceStats} from "@xivgear/xivmath/xivconstants";
import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {makeFakeSet} from "@xivgear/core/test/test_utils";
import {FinalizedAbility} from "@xivgear/core/sims/sim_types";
import {pctSpec, PctSim} from "../../caster/pct/pct_sheet_sim";
import {PctGaugeState} from "../../caster/pct/pct_types";
import * as Actions from "../../caster/pct/pct_actions";
import {StarryMuse} from "../../buffs";

const jobStatMultipliers: JobMultipliers = {
    dexterity: 100,
    hp: 105,
    intelligence: 115,
    mind: 100,
    strength: 50,
    vitality: 100,
};

// Stats roughly in line with a 7.2 BiS set (without party bonus)
const rawStats = {
    crit: 3144,
    determination: 2159,
    dexterity: 440,
    dhit: 1646,
    hp: 0,
    intelligence: 5053,
    mind: 440,
    piety: 440,
    skillspeed: 420,
    spellspeed: 420,
    strength: 440,
    tenacity: 420,
    vitality: 4119,
    wdMag: 146,
    wdPhys: 146,
    weaponDelay: 2.80,
};

const stats = finalizeStats(new RawStats(rawStats), {}, 100, getLevelStats(100), 'PCT', {
    ...getClassJobStats('PCT'),
    jobStatMultipliers: jobStatMultipliers,
}, 5, getRaceStats("Wildwood"));

const pctSet: CharacterGearSet = makeFakeSet(stats);

function abilityUses(result: {abilitiesUsed: readonly FinalizedAbility<PctGaugeState>[]}): FinalizedAbility<PctGaugeState>[] {
    return [...result.abilitiesUsed];
}

function usesOf(uses: FinalizedAbility<PctGaugeState>[], name: string): FinalizedAbility<PctGaugeState>[] {
    return uses.filter(u => u.ability.name === name);
}

describe('PCT sim', () => {
    it('can instantiate, export, and load', () => {
        const inst = pctSpec.makeNewSimInstance();
        const exported = inst.exportSettings();
        const loaded = pctSpec.loadSavedSimInstance(exported);
        expect(loaded.settings.opener).to.equal('2nd-gcd');
        expect(loaded.settings.usePotion).to.equal('auto');
    });

    it('follows the 2nd GCD Starry opener', async () => {
        const sim = new PctSim();
        sim.cycleSettings.totalTime = 120;
        const result = await sim.simulate(pctSet);
        expect(result.mainDpsResult).to.be.greaterThan(0);
        const uses = abilityUses(result.best);
        const names = uses.map(u => u.ability.name);
        const expectedOpener = [
            Actions.StarryMotif,
            Actions.HammerMotif,
            Actions.PomMotif,
            Actions.RainbowDrip,
            Actions.PomMuse,
            Actions.StrikingMuse,
            Actions.WingMotif,
            Actions.StarryMuseAction,
            Actions.SubtractivePalette,
            Actions.HammerStamp,
            Actions.Cyan,
            Actions.Yellow,
            Actions.Magenta,
            Actions.Comet,
            Actions.WingedMuse,
            Actions.Mog,
            Actions.StarPrism,
            Actions.HammerBrush,
            Actions.PolishingHammer,
            Actions.RainbowDrip,
        ].map(a => a.name);
        expect(names.slice(0, expectedOpener.length)).to.deep.equal(expectedOpener);
        // Pre-pull actions are at negative times, Rainbow Drip lands on the pull
        const firstDrip = usesOf(uses, Actions.RainbowDrip.name)[0];
        expect(firstDrip.usedAt).to.be.lessThan(0);
        expect(firstDrip.usedAt + firstDrip.original.appDelayFromStart).to.be.closeTo(0, 0.001);
        // The second Rainbow Drip in the opener is the instant one from Rainbow Bright, inside the Starry window
        const secondDrip = usesOf(uses, Actions.RainbowDrip.name)[1];
        expect(secondDrip.original.castTimeFromStart ?? 0).to.equal(0);
        expect(secondDrip.buffs.map(b => b.name)).to.include(StarryMuse.name);
        // The Comet in the opener consumed the black paint, so no paint should have been overcapped or gone negative
        const comet = usesOf(uses, Actions.Comet.name)[0];
        expect(comet.original.gaugeAfter.monochrome).to.equal(false);
    });

    it('keeps the major cooldowns rolling over a long fight', async () => {
        const sim = new PctSim();
        sim.cycleSettings.totalTime = 600;
        const result = await sim.simulate(pctSet);
        const uses = abilityUses(result.best);

        // Starry Muse every ~2 minutes
        const starry = usesOf(uses, Actions.StarryMuseAction.name);
        expect(starry.length).to.equal(5);
        for (let i = 1; i < starry.length; i++) {
            expect(starry[i].usedAt - starry[i - 1].usedAt).to.be.closeTo(120, 8);
        }

        // Two Striking Muses per 2 minutes
        const striking = usesOf(uses, Actions.StrikingMuse.name);
        expect(striking.length).to.be.greaterThanOrEqual(9);
        // Every hammer combo gets completed
        expect(usesOf(uses, Actions.HammerStamp.name).length).to.equal(striking.length);
        expect(usesOf(uses, Actions.PolishingHammer.name).length).to.equal(striking.length);

        // Three Living Muses per 2 minutes
        const muses = uses.filter(u => [Actions.PomMuse, Actions.WingedMuse, Actions.ClawedMuse, Actions.FangedMuse]
            .some(m => m.name === u.ability.name));
        expect(muses.length).to.be.greaterThanOrEqual(14);
        // Every portrait gets used
        const portraits = usesOf(uses, Actions.Mog.name).length + usesOf(uses, Actions.Madeen.name).length;
        expect(portraits).to.be.greaterThanOrEqual(Math.floor(muses.length / 2) - 1);

        // Rainbow Drip is only ever hardcast pre-pull
        const drips = usesOf(uses, Actions.RainbowDrip.name);
        drips.filter(d => d.usedAt >= 0).forEach(d => {
            expect(d.original.castTimeFromStart ?? 0).to.equal(0);
        });
        // Star Prism once per Starry Muse
        expect(usesOf(uses, Actions.StarPrism.name).length).to.equal(starry.length);

        // Gauge never ends up in a nonsensical state
        uses.forEach(u => {
            const gauge = u.original.gaugeAfter;
            expect(gauge.palette).to.be.within(0, 100);
            expect(gauge.paint).to.be.within(0, 5);
        });

        // Opener-level DPS sanity check: well above a pure RGB spam and below any absurd value
        expect(result.mainDpsResult).to.be.greaterThan(10000);
        expect(result.mainDpsResult).to.be.lessThan(30000);
    });

    it('supports the 3rd GCD opener', async () => {
        const sim = new PctSim();
        sim.settings.opener = '3rd-gcd';
        sim.cycleSettings.totalTime = 120;
        const result = await sim.simulate(pctSet);
        const names = abilityUses(result.best).map(u => u.ability.name);
        expect(names.slice(0, 7)).to.deep.equal([
            Actions.StarryMotif,
            Actions.HammerMotif,
            Actions.PomMotif,
            Actions.RainbowDrip,
            Actions.StrikingMuse,
            Actions.Holy,
            Actions.PomMuse,
        ].map(a => a.name));
        expect(result.mainDpsResult).to.be.greaterThan(0);
    });
});
