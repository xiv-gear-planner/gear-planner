import { SimSpec } from "../../simulation";
import {
    CycleSimResult,
    ExternalCycleSettings,
    Rotation
} from "../sim_processors";
import { Swiftcast } from "../common/swiftcast";
import { STANDARD_ANIMATION_LOCK } from "@xivgear/xivmath/xivconstants";
import * as blu from "./blu_common";

export interface BluFlame60SimResult extends CycleSimResult {
}

interface BluFlame60Settings extends blu.BluSimSettings {
}

export interface BluFlame60SettingsExternal extends ExternalCycleSettings<BluFlame60Settings> {
}

export const BluFlame60Spec: SimSpec<BluFlame60Sim, BluFlame60SettingsExternal> = {
    displayName: "BLU Flame 60s",
    stub: "blu-flame60",
    supportedJobs: ["BLU"],
    isDefaultSim: false,
    description: "Simulates a BLU Mortal Flame rotation with Moon Flute windows every 60s.",

    makeNewSimInstance(): BluFlame60Sim {
        return new BluFlame60Sim();
    },

    loadSavedSimInstance(exported: BluFlame60SettingsExternal) {
        return new BluFlame60Sim(exported);
    }
}

export class BluFlame60Sim extends blu.BluSim<BluFlame60SimResult, BluFlame60Settings> {
    spec = BluFlame60Spec;
    displayName = BluFlame60Spec.displayName;
    shortName = "blu-flame60";

    constructor(settings?: BluFlame60SettingsExternal) {
        super(settings);
    }

    useOgcdFiller(cp: blu.BLUCycleProcessor): void {
        const stdWeaveTime = cp.nextGcdTime - STANDARD_ANIMATION_LOCK;
        const quasarReady = cp.cdTracker.canUse(blu.Quasar, stdWeaveTime);
        const shockStrikeReady = cp.cdTracker.canUse(blu.ShockStrike, stdWeaveTime);
        const FeatherRainReady = cp.cdTracker.canUse(blu.FeatherRain, stdWeaveTime);

        if (FeatherRainReady) {
            cp.use(blu.FeatherRain);
            return;
        }

        if (shockStrikeReady && cp.remainingTime < blu.ShockStrike.cooldown.time) {
            cp.use(blu.ShockStrike);
            return;
        }

        if (quasarReady && cp.remainingTime < blu.Quasar.cooldown.time) {
            cp.use(blu.Quasar);
            return;
        }
    }

    useFiller(cp: blu.BLUCycleProcessor) {
        const stdWeaveTime = cp.nextGcdTime + cp.gcdRecast - STANDARD_ANIMATION_LOCK;
        const featherRainReady = cp.cdTracker.canUse(blu.FeatherRain, stdWeaveTime);

        // reapply Bleeding if about to expire and will get at least 5 buffed ticks (>440 potency) from use
        const bleedComboTime = cp.gcdRecast + cp.longGcdCast;
        const nextBleedStart = cp.nextGcdTime + bleedComboTime;
        const bloomCd = cp.cdTracker.statusOf(blu.Nightbloom);

        // don't block possible ogcd weaves
        const nextWeaveTime = cp.nextGcdTime + cp.gcdRecast * 2;
        const featherRainSoon = !(cp.cdTracker.canUse(blu.FeatherRain, nextWeaveTime) === featherRainReady);

        if (!featherRainSoon && cp.bleedEnd < nextBleedStart &&
            Math.min(bloomCd.readyAt.absolute - bleedComboTime,
            cp.remainingTime - bleedComboTime) > 15)
        {
            cp.use(blu.Bristle);
            this.useOgcdFiller(cp);
            this.useOgcdFiller(cp);
            cp.use(blu.SongOfTorment);
            return;
        }

        // if an ogcd will be ready, weave after Sonic Boom
        if (featherRainReady) {
            cp.use(blu.SonicBoom);
            this.useOgcdFiller(cp);
            this.useOgcdFiller(cp);
            return;
        }

        // use Rose of Destruction if off cooldown and it won't interfere with the next Flute window
        if (cp.isReady(blu.RoseOfDestruction) &&
            cp.cdTracker.statusOfAt(blu.ShockStrike, cp.nextGcdTime).readyAt.relative >
            cp.stats.gcdMag(blu.RoseOfDestruction.cooldown.time)) 
        {
            cp.use(blu.RoseOfDestruction);
            return;
        }

        // otherwise, use a generic 220p filler
        cp.use(blu.FeculentFlood);
    }

    getRotationsToSimulate(): Rotation<blu.BLUCycleProcessor>[] {
        let sim = this;
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

                // cycle based off of Nightbloom (fixed cooldown: 120s)                
                cp.remainingCycles(cycle => {
                    // TODO: this is a hack to avoid floating point errors at fast gcds
                    if (cp.gcdRecast < 2.19) {
                        const currentTime = cp.currentTime;
                        const buffHistory = cp.buffHistory.filter(h => h.buff.name === "Waxing Nocturne");
                        const buffStart = buffHistory[buffHistory.length - 1].start;
                        if (buffStart > currentTime) {
                            cp.currentTime = buffStart;
                        }
                    }
                    // even Flute window
                    cycle.use(blu.Nightbloom);
                    cycle.use(blu.TripleTrident);
                    cycle.use(blu.ShockStrike);

                    // first cycle Mortal Flame opener
                    if (cycle.cycleNumber === 0) {
                        cycle.use(blu.Bristle);
                        cycle.use(blu.Quasar);
                        cycle.use(blu.FeatherRain);
                        cycle.use(blu.MortalFlame);
                    }
                    // even Flute window after opener
                    else {
                        cycle.use(blu.SonicBoom);
                        cycle.use(blu.Quasar);
                        sim.useOgcdFiller(cp);
                        cycle.use(blu.RoseOfDestruction);
                    }
                    cycle.use(blu.SeaShanty);
                    cycle.use(blu.Bristle);
                    cycle.use(Swiftcast);
                    if (cp.gcdRecast <= 2.20) {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.MatraMagic);
                    if (cp.gcdRecast <= 2.20) {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.Apokalypsis);
                    cp.doWaning();

                    // loop until odd Flute window
                    const preBleed = cp.gcdRecast * 4;
                    let i = 0;
                    while (Math.min(cp.remainingGcdTime, cp.bleedEnd - cp.currentTime) > preBleed) {
                        sim.useFiller(cp);
                    }

                    // odd Flute window
                    cycle.use(blu.FeculentFlood);
                    cycle.use(blu.Bristle);
                    cycle.use(blu.MoonFlute);
                    cycle.use(blu.SongOfTorment);
                    cycle.use(blu.ShockStrike);
                    cycle.use(blu.WingedReprobation);
                    cycle.use(blu.Quasar);
                    sim.useOgcdFiller(cp);
                    cycle.use(blu.RoseOfDestruction);
                    cycle.use(blu.WingedReprobation);
                    cycle.use(blu.GlassDance);
                    sim.useOgcdFiller(cp);
                    cycle.use(blu.WingedReprobation);
                    sim.useOgcdFiller(cp);
                    cycle.use(blu.WingedReprobation);
                    sim.useOgcdFiller(cp);
                    cycle.use(blu.PhantomFlurry);
                    cp.doWaning();

                    // loop until 4 gcds before Nightbloom comes off cooldown
                    const preBloom = cp.gcdRecast * 4;
                    let j = 0;
                    while (Math.min(cp.remainingGcdTime, cp.cdTracker.statusOf(blu.Nightbloom).readyAt.relative) > preBloom) {
                        sim.useFiller(cp);
                    }

                    // start the next even Flute window, if one exists
                    if (cp.remainingGcdTime > preBloom) {
                        cycle.use(blu.FeculentFlood);
                        cycle.use(blu.Whistle);
                        cycle.use(blu.Tingle);
                        cycle.use(blu.MoonFlute);
                    } else {
                        // otherwise, finish off the fight with a Final Sting combo
                        sim.useStingCombo(cp);
                    }
                });
            }
        }];
    }
}
