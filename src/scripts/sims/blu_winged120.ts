import { SimSpec } from "../simulation";
import {
    CycleSimResult,
    ExternalCycleSettings,
    CycleProcessor,
    Rotation} from "./sim_processors";
import { Swiftcast } from "./common/swiftcast";
import { CASTER_TAX, STANDARD_ANIMATION_LOCK } from "../xivconstants";
import * as blu from "./blu_common";

export interface BluWinged120SimResult extends CycleSimResult {
}

interface BluWinged120Settings extends blu.BluSimSettings {
}

export interface BluWinged120SettingsExternal extends ExternalCycleSettings<BluWinged120Settings> {
}

export const BluWinged120Spec: SimSpec<BluWinged120Sim, BluWinged120SettingsExternal> = {
    displayName: "BLU Winged 120s",
    stub: "blu-winged120",
    supportedJobs: ["BLU"],
    isDefaultSim: true,

    makeNewSimInstance(): BluWinged120Sim {
        return new BluWinged120Sim();
    },

    loadSavedSimInstance(exported: BluWinged120SettingsExternal) {
        return new BluWinged120Sim(exported);
    }
}

export class BluWinged120Sim extends blu.BluSim<BluWinged120SimResult, BluWinged120Settings, BluWinged120SettingsExternal> {
    spec = BluWinged120Spec;
    displayName = BluWinged120Spec.displayName;
    shortName = "blu-winged120";

    constructor(settings?: BluWinged120SettingsExternal) {
        super(settings);
    }

    doOpener(cp: CycleProcessor) {
        // delay Flute if J Kick won't be ready on time to clip
        if (!cp.cdTracker.canUse(blu.JKick, cp.nextGcdTime + this.rotationState.gcdBase)) {
            cp.use(blu.FeculentFlood);
        }
        this.useFlute(cp);
        const jkickWeaveTime = cp.nextGcdTime - blu.JKick.animationLock;
        if (cp.cdTracker.canUse(blu.JKick, jkickWeaveTime)) {
            cp.use(blu.JKick);
        }
        cp.use(blu.TripleTrident);
        this.useBleed(cp, blu.Nightbloom);
        this.useWinged(cp);
        const featherWeaveTime = cp.nextGcdTime - blu.FeatherRain.animationLock;
        if (cp.cdTracker.canUse(blu.FeatherRain, featherWeaveTime)) {
            cp.use(blu.FeatherRain);
        }
        cp.use(blu.SeaShanty);
        this.useWinged(cp);
        const shockWeaveTime = cp.nextGcdTime - blu.ShockStrike.animationLock;
        if (cp.cdTracker.canUse(blu.ShockStrike, shockWeaveTime)) {
            cp.use(blu.ShockStrike);
        }
        cp.use(blu.BeingMortal);
        cp.use(blu.Bristle);
        cp.use(Swiftcast);
        this.useSurpanakha(cp);
        this.useSurpanakha(cp);
        this.useSurpanakha(cp);
        this.useSurpanakha(cp);
        this.useMatra(cp);
        this.useChanneled(cp, blu.PhantomFlurry);
        this.doWaning(cp);
    }

    useOgcdFiller(cp: CycleProcessor): void {
        const stdWeaveTime = cp.nextGcdTime - STANDARD_ANIMATION_LOCK;
        const jkickWeaveTime = cp.nextGcdTime - blu.JKick.animationLock;

        // single weave J Kick
        if (cp.cdTracker.canUse(blu.JKick, jkickWeaveTime)) {
            cp.use(blu.JKick);
            return;
        }

        if (cp.cdTracker.canUse(blu.FeatherRain, stdWeaveTime)) {
            cp.use(blu.FeatherRain);
        }
        
        if (cp.cdTracker.canUse(blu.ShockStrike, stdWeaveTime)) {
            cp.use(blu.ShockStrike);
        }
    }

    useFiller(cp: CycleProcessor) {
        const gcdBase = this.rotationState.gcdBase;
        const nextGcdTime = cp.nextGcdTime;
        const stdWeaveTime = nextGcdTime + gcdBase - STANDARD_ANIMATION_LOCK;
        const jkickWeaveTime = nextGcdTime + gcdBase - blu.JKick.animationLock;
        const jKickReady = cp.cdTracker.canUse(blu.JKick, jkickWeaveTime);
        const featherRainReady = cp.cdTracker.canUse(blu.FeatherRain, stdWeaveTime);
        const shockStrikeReady = cp.cdTracker.canUse(blu.ShockStrike, stdWeaveTime);

        // reapply Bleeding if about to expire and will get at least 5 buffed ticks (>440 potency) from use
        const longGcdCast = this.rotationState.longGcdCast;
        const bleedComboTime = gcdBase + longGcdCast;
        const nextBleedStart = nextGcdTime + bleedComboTime;
        const bloomCd = cp.cdTracker.statusOf(blu.Nightbloom);

        // don't block possible ogcd weaves
        const nextWeaveTime = nextGcdTime + gcdBase * 2;
        const jKickSoon = !(cp.cdTracker.canUse(blu.JKick, nextWeaveTime) === jKickReady);
        const featherRainSoon = !(cp.cdTracker.canUse(blu.FeatherRain, nextWeaveTime) === featherRainReady);
        const shockStrikeSoon = !(cp.cdTracker.canUse(blu.ShockStrike, nextWeaveTime) === shockStrikeReady);
        const weaveSoon = jKickSoon || featherRainSoon || shockStrikeSoon;

        if (!weaveSoon && this.rotationState.bleedEnd < nextBleedStart &&
            Math.min(bloomCd.readyAt.absolute - bleedComboTime,
            cp.remainingTime - bleedComboTime) > 15)
        {
            cp.use(blu.Bristle);
            this.useOgcdFiller(cp);
            this.useBleed(cp, blu.SongOfTorment);
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
        if (cp.cdTracker.canUse(blu.RoseOfDestruction, nextGcdTime)) {

            cp.use(blu.RoseOfDestruction);
            return;
        }

        // otherwise, use a generic 220p filler
        cp.use(blu.FeculentFlood);
    }

    getRotationsToSimulate(): Rotation[] {
        let sim = this;
        return [{
            // Nightbloom cd + J Kick clip @ 2.5 gcd
            cycleTime: 120 + 0.5,
            apply(cp: CycleProcessor) {
                const gcdBase = sim.rotationState.gcdBase = cp.stats.gcdMag(cp.gcdBase);
                sim.rotationState.longGcdCast = cp.stats.gcdMag(blu.RoseOfDestruction.cast) + CASTER_TAX;
                sim.rotationState.shortGcdCast = cp.stats.gcdMag(blu.SonicBoom.cast) + CASTER_TAX;
                const jKickClip = blu.JKick.animationLock + sim.rotationState.longGcdCast - gcdBase;

                // Whistle + Tingle + Rose + Flute + J Kick clip + Trident cast
                const preBloomTime = gcdBase * 4 + jKickClip + sim.rotationState.longGcdCast;

                console.log({
                    gcdBase: gcdBase,
                    longGcdCast: sim.rotationState.longGcdCast,
                    shortGcdCast: sim.rotationState.shortGcdCast,
                    preBloomTime: preBloomTime,
                });

                sim.applyStances(cp);

                // pre-pull
                cp.use(blu.Whistle);
                cp.use(blu.Tingle);

                while (cp.remainingGcdTime > 0) {
                    if (cp.cdTracker.canUse(blu.RoseOfDestruction, cp.nextGcdTime)) {
                        cp.use(blu.RoseOfDestruction);
                    } else {
                        cp.use(blu.FeculentFlood);
                    }
                    sim.doOpener(cp);

                    // loop until 4 gcds from next Flute window
                    while (Math.min(cp.remainingGcdTime, cp.cdTracker.statusOf(blu.Nightbloom).readyAt.relative) > preBloomTime) {
                        sim.useFiller(cp);
                    }

                    // set up the next Flute window, if one exists
                    if (cp.remainingGcdTime > preBloomTime) {
                        cp.use(blu.Whistle);
                        cp.use(blu.Tingle);
                    } else {
                        // otherwise, finish off the fight with a Final Sting combo
                        cp.use(blu.FeculentFlood);
                        sim.useStingCombo(cp);
                    }
                }
            }
        }];
    }
}
