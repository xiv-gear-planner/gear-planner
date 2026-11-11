import {describe, it} from "mocha";
import {expect} from "chai";
import {CharacterGearSet} from "@xivgear/core/gear";
import {ComputedSetStats, JobMultipliers, MedicineItem, RawStats} from "@xivgear/xivmath/geartypes";
import {getClassJobStats, getLevelStats, getRaceStats} from "@xivgear/xivmath/xivconstants";
import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {makeFakeSet} from "@xivgear/core/test/test_utils";
import {FinalizedAbility} from "@xivgear/core/sims/sim_types";
import {pctSpec, PctSim} from "../../caster/pct/pct_sheet_sim";
import {PctGaugeState} from "../../caster/pct/pct_types";
import * as Actions from "../../caster/pct/pct_actions";
import {StarryMuse} from "../../buffs";

type PctUse = FinalizedAbility<PctGaugeState>;

const jobStatMultipliers: JobMultipliers = {
    dexterity: 100,
    hp: 105,
    intelligence: 115,
    mind: 100,
    strength: 50,
    vitality: 100,
};

/**
 * Stats roughly in line with a 7.2 BiS set (without party bonus), with the given amount of spell speed.
 */
function makeStats(spellspeed: number): ComputedSetStats {
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
        spellspeed: spellspeed,
        strength: 440,
        tenacity: 420,
        vitality: 4119,
        wdMag: 146,
        wdPhys: 146,
        weaponDelay: 2.80,
    };
    return finalizeStats(new RawStats(rawStats), {}, 100, getLevelStats(100), 'PCT', {
        ...getClassJobStats('PCT'),
        jobStatMultipliers: jobStatMultipliers,
    }, 5, getRaceStats("Wildwood"));
}

// 2.50 and 2.38 GCD
const SPELL_SPEEDS = [420, 1400];

const pctSet: CharacterGearSet = makeFakeSet(makeStats(420));

const SUBTRACTIVE_SPELLS = [Actions.Cyan, Actions.Yellow, Actions.Magenta].map(a => a.name);
const LIVING_MUSES = [Actions.PomMuse, Actions.WingedMuse, Actions.ClawedMuse, Actions.FangedMuse].map(a => a.name);
const PORTRAITS = [Actions.Mog, Actions.Madeen].map(a => a.name);

/**
 * Equip a potion on a fake set.
 */
function medicated(set: CharacterGearSet): CharacterGearSet {
    const medicine = {
        id: 44165,
        name: 'Grade 3 Gemdraught of Intelligence',
        nameTranslation: {
            asCurrentLang: 'Grade 3 Gemdraught of Intelligence',
        },
        ilvl: 730,
        bonuses: {
            intelligence: {
                percentage: 10,
                max: 461,
            },
        },
    } as unknown as MedicineItem;
    const copy = makeFakeSet(set.computedStats);
    Object.defineProperty(copy, 'medicine', {
        get: () => medicine,
    });
    return copy;
}

async function runSim(totalTime: number, set: CharacterGearSet = pctSet, sim: PctSim = new PctSim()): Promise<PctUse[]> {
    sim.cycleSettings.totalTime = totalTime;
    const result = await sim.simulate(set);
    expect(result.mainDpsResult).to.be.greaterThan(0);
    return [...result.best.abilitiesUsed] as PctUse[];
}

function usesOf(uses: PctUse[], name: string): PctUse[] {
    return uses.filter(u => u.ability.name === name);
}

function names(uses: PctUse[]): string[] {
    return uses.map(u => u.ability.name);
}

function hasBuff(use: PctUse, buffName: string): boolean {
    return use.buffs.some(b => b.name === buffName);
}

function isGcd(use: PctUse): boolean {
    return use.ability.type === 'gcd';
}

/**
 * Everything used after each Starry Muse and before the next one.
 */
function starryCycles(uses: PctUse[]): { starry: PctUse, before: PctUse[], after: PctUse[] }[] {
    const starryIndices = uses.flatMap((u, i) => u.ability.name === Actions.StarryMuseAction.name ? [i] : []);
    return starryIndices.map((index, i) => ({
        starry: uses[index],
        before: uses.slice(0, index),
        after: uses.slice(index + 1, starryIndices[i + 1] ?? uses.length),
    }));
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
        const uses = await runSim(120);
        const expectedOpener = [
            Actions.StarryMotif,
            Actions.HammerMotif,
            Actions.PomMotif,
            Actions.RainbowDrip,
            Actions.PomMuse,
            Actions.StrikingMuse,
            Actions.WingMotif,
            Actions.StarryMuseAction,
            Actions.HammerStamp,
            Actions.SubtractivePalette,
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
            Actions.Red,
            Actions.Swiftcast,
            Actions.Green,
        ].map(a => a.name);
        expect(names(uses).slice(0, expectedOpener.length)).to.deep.equal(expectedOpener);
        // Pre-pull actions are at negative times, Rainbow Drip lands on the pull
        const firstDrip = usesOf(uses, Actions.RainbowDrip.name)[0];
        expect(firstDrip.usedAt).to.be.lessThan(0);
        expect(firstDrip.usedAt + firstDrip.original.appDelayFromStart).to.be.closeTo(0, 0.001);
        // The second Rainbow Drip in the opener is the instant one from Rainbow Bright, inside the Starry window
        const secondDrip = usesOf(uses, Actions.RainbowDrip.name)[1];
        expect(secondDrip.original.castTimeFromStart ?? 0).to.equal(0);
        expect(hasBuff(secondDrip, StarryMuse.name)).to.equal(true);
        // Nine GCDs fit inside Starry Muse
        const buffedGcds = uses.filter(u => isGcd(u) && hasBuff(u, StarryMuse.name));
        expect(names(buffedGcds)).to.deep.equal(expectedOpener.slice(8, 20).filter(name => ![
            Actions.SubtractivePalette.name, Actions.WingedMuse.name, Actions.Mog.name,
        ].includes(name)));
        // The Comet in the opener consumed the black paint
        const comet = usesOf(uses, Actions.Comet.name)[0];
        expect(comet.original.gaugeAfter.monochrome).to.equal(false);
    });

    it('supports the 3rd GCD opener', async () => {
        const sim = new PctSim();
        sim.settings.opener = '3rd-gcd';
        const uses = await runSim(120, pctSet, sim);
        const expectedOpener = [
            Actions.StarryMotif,
            Actions.HammerMotif,
            Actions.PomMotif,
            Actions.RainbowDrip,
            Actions.StrikingMuse,
            Actions.Holy,
            Actions.PomMuse,
            Actions.WingMotif,
            Actions.StarryMuseAction,
            Actions.HammerStamp,
            Actions.SubtractivePalette,
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
            Actions.Red,
            Actions.Swiftcast,
            Actions.ClawMotif,
            Actions.ClawedMuse,
        ].map(a => a.name);
        expect(names(uses).slice(0, expectedOpener.length)).to.deep.equal(expectedOpener);
        // Striking Muse cannot be used before the pull
        expect(usesOf(uses, Actions.StrikingMuse.name)[0].usedAt).to.be.at.least(0);
    });

    it('keeps the major cooldowns rolling over a long fight', async () => {
        const uses = await runSim(600);

        // Starry Muse every 2 minutes, with very little drift
        const starry = usesOf(uses, Actions.StarryMuseAction.name);
        expect(starry.length).to.equal(5);
        for (let i = 1; i < starry.length; i++) {
            expect(starry[i].usedAt - starry[i - 1].usedAt).to.be.within(120, 121);
        }

        // Two Striking Muses per 2 minutes
        const striking = usesOf(uses, Actions.StrikingMuse.name);
        expect(striking.length).to.be.greaterThanOrEqual(9);
        // Every hammer combo gets completed
        expect(usesOf(uses, Actions.HammerStamp.name).length).to.equal(striking.length);
        expect(usesOf(uses, Actions.PolishingHammer.name).length).to.equal(striking.length);

        // Three Living Muses per 2 minutes
        const muses = uses.filter(u => LIVING_MUSES.includes(u.ability.name));
        expect(muses.length).to.be.greaterThanOrEqual(14);
        // Every portrait gets used
        const portraits = uses.filter(u => PORTRAITS.includes(u.ability.name));
        expect(portraits.length).to.be.greaterThanOrEqual(Math.floor(muses.length / 2) - 1);

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
    });

    SPELL_SPEEDS.forEach(spellspeed => {
        describe(`with ${spellspeed} spell speed`, () => {
            const stats = makeStats(spellspeed);
            const set = makeFakeSet(stats);

            it('sets up every burst window properly', async () => {
                const uses = await runSim(720, set);
                const cycles = starryCycles(uses);
                expect(cycles.length).to.equal(6);
                // The opener is tested separately
                cycles.slice(1).forEach(cycle => {
                    const gcdsAfter = cycle.after.filter(isGcd);
                    // Subtractive Palette is used before Starry Muse, so that the window starts with a hardcast
                    // subtractive spell
                    const first = gcdsAfter[0];
                    expect(SUBTRACTIVE_SPELLS).to.include(first.ability.name);
                    expect(first.original.castTimeFromStart).to.be.greaterThan(0);
                    expect(hasBuff(first, StarryMuse.name)).to.equal(true);
                    // Starry Muse is weaved late enough for nine GCDs to fit
                    expect(first.usedAt - cycle.starry.usedAt).to.be.at.most(1.25 + 0.001);
                    const buffed = cycle.after.filter(u => hasBuff(u, StarryMuse.name));
                    const buffedGcds = names(buffed.filter(isGcd));
                    expect(buffedGcds.length).to.equal(9);
                    const count = (...abilityNames: string[]) => buffedGcds.filter(name => abilityNames.includes(name)).length;
                    // 2-3 subtractive spells and 1-2 Comets
                    expect(count(...SUBTRACTIVE_SPELLS)).to.be.within(2, 3);
                    expect(count(Actions.Comet.name)).to.be.within(1, 2);
                    expect(count(...SUBTRACTIVE_SPELLS, Actions.Comet.name)).to.equal(4);
                    // Then Star Prism, the whole hammer combo, and Rainbow Drip
                    expect(buffedGcds.slice(4)).to.deep.equal([
                        Actions.StarPrism, Actions.HammerStamp, Actions.HammerBrush, Actions.PolishingHammer, Actions.RainbowDrip,
                    ].map(a => a.name));
                    // A portrait and a Living Muse in every window
                    expect(buffed.filter(u => PORTRAITS.includes(u.ability.name)).length).to.equal(1);
                    expect(buffed.filter(u => LIVING_MUSES.includes(u.ability.name)).length).to.be.at.least(1);
                });
                // Madeen is the portrait in most windows
                const buffedMadeens = usesOf(uses, Actions.Madeen.name).filter(u => hasBuff(u, StarryMuse.name));
                expect(buffedMadeens.length).to.be.at.least(3);
            });

            it('barely uses Holy in White before the end of the fight', async () => {
                const uses = await runSim(720, set);
                const holy = usesOf(uses, Actions.Holy.name);
                // Never in burst
                holy.forEach(u => expect(hasBuff(u, StarryMuse.name)).to.equal(false));
                // The odd one to line up Starry Muse is fine
                expect(holy.filter(u => u.usedAt < 720 - 30).length).to.be.at.most(2);
            });

            it('keeps 50 gauge in reserve for the next burst window', async () => {
                const uses = await runSim(720, set);
                const starryTimes = usesOf(uses, Actions.StarryMuseAction.name).map(u => u.usedAt);
                uses.forEach((u, i) => {
                    if (u.ability.name !== Actions.SubtractivePalette.name || i === 0) {
                        return;
                    }
                    const paletteBefore = uses[i - 1].original.gaugeAfter.palette;
                    const paletteAfter = u.original.gaugeAfter.palette;
                    const nextStarry = starryTimes.find(time => time > u.usedAt);
                    // If this dips into the reserve, then it is the one for the upcoming window
                    if (paletteAfter < paletteBefore && paletteAfter < 50 && nextStarry !== undefined) {
                        expect(nextStarry - u.usedAt).to.be.lessThan(24);
                    }
                });
            });

            it('only uses Swiftcast to get a spell into a buff', async () => {
                const uses = await runSim(720, medicated(set));
                const swiftcasts = uses.flatMap((u, i) => u.ability.name === Actions.Swiftcast.name ? [i] : []);
                // The first one is part of the opener
                swiftcasts.forEach(index => {
                    const next = uses.slice(index + 1).find(isGcd);
                    expect(next.original.castTimeFromStart ?? 0).to.equal(0);
                    expect(hasBuff(next, StarryMuse.name) || hasBuff(next, 'Medicated')).to.equal(true);
                });
            });

            it('never uses Subtractive Palette while it is still active', async () => {
                const uses = await runSim(720, set);
                let stacks = 0;
                uses.forEach(u => {
                    if (u.ability.name === Actions.SubtractivePalette.name) {
                        expect(stacks).to.equal(0);
                        stacks = 3;
                    }
                    else if (SUBTRACTIVE_SPELLS.includes(u.ability.name)) {
                        expect(stacks).to.be.greaterThan(0);
                        stacks--;
                    }
                    else if ([Actions.Red, Actions.Green, Actions.Blue].some(a => a.name === u.ability.name)) {
                        // RGB cannot be cast under Subtractive Palette
                        expect(stacks).to.equal(0);
                    }
                });
            });

            it('does not weave more than is realistically possible', async () => {
                const uses = await runSim(720, set);
                const inCombat = uses.filter(u => u.usedAt > 0);
                const gcds = inCombat.filter(isGcd);
                for (let i = 0; i < gcds.length - 1; i++) {
                    const gcd = gcds[i];
                    const weaves = inCombat.filter(u => !isGcd(u) && u.usedAt > gcd.usedAt && u.usedAt < gcds[i + 1].usedAt);
                    expect(weaves.length).to.be.at.most(2);
                    // Only a single weave after a hasted Star Prism
                    if (gcd.ability.name === Actions.StarPrism.name && gcd.combinedEffects.haste > 0) {
                        expect(weaves.length).to.be.at.most(1);
                    }
                    // No GCD clipping
                    const recast = gcd.original.totalTimeTaken;
                    expect(gcds[i + 1].usedAt - gcd.usedAt).to.be.closeTo(recast, 0.001);
                }
            });

            it('uses fixed recasts for motifs and the correct recast for the instant Rainbow Drip', async () => {
                const uses = await runSim(300, set);
                const gcds = uses.filter(isGcd);
                gcds.forEach((gcd, i) => {
                    const next = gcds[i + 1];
                    if (next === undefined) {
                        return;
                    }
                    const interval = next.usedAt - gcd.usedAt;
                    if (gcd.ability.name.endsWith('Motif') && gcd.original.castTimeFromStart > 0) {
                        // Motifs are not affected by spell speed
                        expect(gcd.original.castTimeFromStart).to.be.closeTo(3, 0.001);
                        expect(interval).to.be.closeTo(4, 0.001);
                    }
                    else if (gcd.ability.name === Actions.RainbowDrip.name && gcd.usedAt > 0) {
                        // The recast of Rainbow Drip, minus 3.5 seconds
                        expect(interval).to.be.closeTo(stats.gcdMag(6) - 3.5, 0.001);
                    }
                });
            });
        });
    });

    it('uses the potion right before the burst window', async () => {
        const set = medicated(pctSet);
        const uses = await runSim(420, set);
        const potions = uses.filter(u => u.ability.attackType === 'Item');
        // Opener and six minutes
        expect(potions.length).to.equal(2);
        expect(potions[0].usedAt).to.be.lessThan(1);
        const sixMinutes = starryCycles(uses)[3];
        expect(sixMinutes.starry.usedAt).to.be.within(360, 372);
        expect(potions[1].usedAt).to.be.within(sixMinutes.starry.usedAt - 8, sixMinutes.starry.usedAt);
        // It covers the whole window
        const buffed = sixMinutes.after.filter(u => hasBuff(u, StarryMuse.name));
        expect(buffed.filter(isGcd).length).to.equal(9);
        buffed.forEach(u => expect(hasBuff(u, 'Medicated')).to.equal(true));
    });
});
