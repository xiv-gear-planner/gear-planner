import { SimSpec } from "../simulation";
import {
    CycleSimResult,
    ExternalCycleSettings,
    Rotation
} from "./sim_processors";
import { Swiftcast } from "./common/swiftcast";
import { STANDARD_ANIMATION_LOCK } from "../xivconstants";
import * as blu from "./blu_common";

export interface BluF2PSimResult extends CycleSimResult {
}

interface BluF2PSettings extends blu.BluSimSettings {
}

export interface BluF2PSettingsExternal extends ExternalCycleSettings<BluF2PSettings> {
}

export const BluF2PSpec: SimSpec<BluF2PSim, BluF2PSettingsExternal> = {
    displayName: "BLU Free Trial",
    stub: "blu-f2p",
    supportedJobs: ["BLU"],
    isDefaultSim: false,

    makeNewSimInstance(): BluF2PSim {
        return new BluF2PSim();
    },

    loadSavedSimInstance(exported: BluF2PSettingsExternal) {
        return new BluF2PSim(exported);
    }
}

export class BluF2PSim extends blu.BluSim<BluF2PSimResult, BluF2PSettings> {
    spec = BluF2PSpec;
    displayName = BluF2PSpec.displayName;
    shortName = "blu-f2p";

    constructor(settings?: BluF2PSettingsExternal) {
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

        // use Rose of Destruction if off cooldown and it won't interfere with the next Flute window
        if (cp.cdTracker.canUse(blu.RoseOfDestruction, cp.nextGcdTime) &&
            cp.cdTracker.statusOfAt(blu.Nightbloom, cp.nextGcdTime).readyAt.relative >
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
                cp.use(blu.MoonFlute);
                cp.use(blu.JKick);
                cp.use(blu.TripleTrident);
                
                // cycle based off of Nightbloom (fixed cooldown: 120s)                
                cp.remainingCycles(cycle => {
                    cycle.use(blu.Nightbloom);
                    cycle.use(blu.RoseOfDestruction);
                    if (cycle.cycleNumber === 0) {
                        cycle.use(blu.ShockStrike);
                    } else {
                        sim.useOgcdFiller(cp);
                    }
                    if (cycle.cycleNumber > 0 && cp.gcdRecast <= 2.20) {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.Bristle);
                    cycle.use(Swiftcast);
                    cycle.use(blu.GlassDance);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.Surpanakha);
                    cycle.use(blu.MatraMagic);
                    if (cycle.cycleNumber === 0) {
                        cycle.use(blu.FeatherRain);
                    } else {
                        sim.useOgcdFiller(cp);
                    }
                    cycle.use(blu.PhantomFlurry);
                    cp.doWaning();

                    // loop until 4 gcds before Nightbloom comes off cooldown
                    const preBloom = cp.gcdRecast * 4;
                    while (Math.min(cp.remainingGcdTime, cp.cdTracker.statusOf(blu.Nightbloom).readyAt.relative) > preBloom) {
                        sim.useFiller(cp);
                    }

                    // start the next Flute window, if one exists
                    if (cp.remainingGcdTime > preBloom) {
                        cycle.use(blu.Whistle);
                        cycle.use(blu.Tingle);
                        cycle.use(blu.MoonFlute);
                        sim.useOgcdFiller(cp);
                        cycle.use(blu.TripleTrident);
                    } else {
                        // otherwise, finish off the fight with a Final Sting combo
                        sim.useStingCombo(cp);
                    }
                });
            }
        }];
    }
}
