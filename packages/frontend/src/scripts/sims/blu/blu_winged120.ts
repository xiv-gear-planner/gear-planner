import { Swiftcast } from "@xivgear/core/sims/common/swiftcast";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import * as blu from "./blu_common";
import {SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";

export interface BluWinged120SimResult extends CycleSimResult {
}

export interface BluWinged120Settings extends blu.BluSimSettings {
}

export interface BluWinged120SettingsExternal extends ExternalCycleSettings<BluWinged120Settings> {
}

export const BluWinged120Spec: SimSpec<BluWinged120Sim, BluWinged120SettingsExternal> = {
    displayName: "BLU Winged 120s",
    stub: "blu-winged120",
    supportedJobs: ["BLU"],
    isDefaultSim: true,
    description: "Simulates a BLU Winged Reprobation rotation with Moon Flute windows every 120s.",

    makeNewSimInstance(): BluWinged120Sim {
        return new BluWinged120Sim();
    },

    loadSavedSimInstance(exported: BluWinged120SettingsExternal) {
        return new BluWinged120Sim(exported);
    }
};

export class BluWinged120Sim extends blu.BluSim<BluWinged120SimResult, BluWinged120Settings> {
    spec = BluWinged120Spec;
    displayName = BluWinged120Spec.displayName;
    shortName = "blu-winged120";

    constructor(settings?: BluWinged120SettingsExternal) {
        super(settings);
    }

    useOgcdFiller(cp: blu.BLUCycleProcessor): void {
        const stdWeaveTime = cp.nextGcdTime - STANDARD_ANIMATION_LOCK;
        const jkickWeaveTime = cp.nextGcdTime - blu.JKick.animationLock;
        const shockStrikeReady = cp.cdTracker.canUse(blu.ShockStrike, stdWeaveTime);
        const FeatherRainReady = cp.cdTracker.canUse(blu.FeatherRain, stdWeaveTime);
        const jKickReady = cp.cdTracker.canUse(blu.JKick, jkickWeaveTime);

        // double weave Shock Strike and Feather Rain, if ready
        if (shockStrikeReady || FeatherRainReady) {
            if (shockStrikeReady) {
                cp.use(blu.ShockStrike);
            }
            if (FeatherRainReady) {
                cp.use(blu.FeatherRain);
            }
            return;
        }

        // single weave J Kick if ready
        if (jKickReady) {
            cp.use(blu.JKick);
            return;
        }
    }

    useFiller(cp: blu.BLUCycleProcessor) {
        const stdWeaveTime = cp.nextGcdTime + cp.gcdRecast - STANDARD_ANIMATION_LOCK;
        const jkickWeaveTime = cp.nextGcdTime + cp.gcdRecast - blu.JKick.animationLock;
        const jKickReady = cp.cdTracker.canUse(blu.JKick, jkickWeaveTime);
        const featherRainReady = cp.cdTracker.canUse(blu.FeatherRain, stdWeaveTime);
        const shockStrikeReady = cp.cdTracker.canUse(blu.ShockStrike, stdWeaveTime);

        // reapply Bleeding if about to expire and will get at least 5 buffed ticks (>440 potency) from use
        const bleedComboTime = cp.gcdRecast + cp.longGcdCast;
        const nextBleedStart = cp.nextGcdTime + bleedComboTime;
        const bloomCd = cp.cdTracker.statusOf(blu.Nightbloom);

        // don't block possible ogcd weaves
        const nextWeaveTime = cp.nextGcdTime + cp.gcdRecast * 2;
        const jKickSoon = !(cp.cdTracker.canUse(blu.JKick, nextWeaveTime) === jKickReady);
        const featherRainSoon = !(cp.cdTracker.canUse(blu.FeatherRain, nextWeaveTime) === featherRainReady);
        const shockStrikeSoon = !(cp.cdTracker.canUse(blu.ShockStrike, nextWeaveTime) === shockStrikeReady);
        const weaveSoon = jKickSoon || featherRainSoon || shockStrikeSoon;

        if (!weaveSoon && cp.bleedEnd < nextBleedStart &&
            Math.min(bloomCd.readyAt.absolute - bleedComboTime,
            cp.remainingTime - bleedComboTime) > 15)
        {
            cp.use(blu.Bristle);
            this.useOgcdFiller(cp);
            cp.use(blu.SongOfTorment);
            return;
        }

        // if an ogcd will be ready, weave after Sonic Boom
        const weaveReady = jKickReady || featherRainReady || shockStrikeReady;
        if (weaveReady) {
            cp.use(blu.SonicBoom);
            this.useOgcdFiller(cp);
            return;
        }

        // use Rose of Destruction if off cooldown
        if (cp.isReady(blu.RoseOfDestruction)) {
            cp.use(blu.RoseOfDestruction);
            return;
        }

        // if fight is about to end, use remaining Winged Reprobation stacks
        if (cp.remainingTime < blu.WingedReprobation.cooldown.time &&
            cp.isReady(blu.WingedReprobation))
        {
            cp.use(blu.WingedReprobation);
            this.useOgcdFiller(cp);
            return;
        }

        // otherwise, use a generic 220p filler
        cp.use(blu.FeculentFlood);
    }

    getRotationsToSimulate(): Rotation<blu.BLUCycleProcessor>[] {
        const sim = this;
        return [{
            cycleTime: 120,
            apply(cp: blu.BLUCycleProcessor) {
                // activate any stances set
                sim.applyStances(cp);

                // pre-pull
                cp.use(blu.Whistle);
                cp.use(blu.Tingle);

                // start of first cycle opener
                cp.use(blu.RoseOfDestruction);
                cp.use(blu.MoonFlute);
                cp.use(blu.JKick);
                cp.use(blu.TripleTrident);
                
                // cycle based off of Nightbloom (fixed cooldown: 120s)                
                cp.remainingCycles(cycle => {
                    cycle.use(blu.Nightbloom);
                    cycle.use(blu.WingedReprobation);
                    if (cycle.cycleNumber === 0) {
                        cycle.use(blu.FeatherRain);
                    } else {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.SeaShanty);
                    cycle.use(blu.WingedReprobation);
                    if (cycle.cycleNumber === 0) {
                        cycle.use(blu.ShockStrike);
                    } else {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.BeingMortal);
                    cycle.use(blu.Bristle);
                    cycle.use(Swiftcast);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.MatraMagic);
                    if (cp.gcdRecast <= 2.20) {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.PhantomFlurry);
                    cp.doWaning();

                    // loop until 5 gcds before Nightbloom comes off cooldown
                    const preBloom = cp.gcdRecast * 5;
                    while (Math.min(cp.remainingGcdTime, cp.cdTracker.statusOf(blu.Nightbloom).readyAt.relative) > preBloom) {
                        sim.useFiller(cp);
                    }

                    // start the next Flute window, if one exists
                    if (cp.remainingGcdTime > preBloom) {
                        cycle.use(blu.Whistle);
                        cycle.use(blu.Tingle);
                        if (cp.isReady(blu.RoseOfDestruction)) {
                            cycle.use(blu.RoseOfDestruction);
                        } else {
                            cycle.use(blu.FeculentFlood);
                        }
                        cycle.use(blu.MoonFlute);
                        sim.useOgcdFiller(cp);
                        cycle.use(blu.TripleTrident);
                    } else {
                        // otherwise, finish off the fight with a Final Sting combo
                        if (cp.isReady(blu.RoseOfDestruction)) {
                            cycle.use(blu.RoseOfDestruction);
                        } else {
                            if (cp.isReady(blu.WingedReprobation)) {
                                cycle.use(blu.WingedReprobation);
                                sim.useOgcdFiller(cp);
                            } else {
                                cycle.use(blu.FeculentFlood);
                            }
                        }
                        sim.useStingCombo(cp);
                    }
                });
            }
        }];
    }
}
