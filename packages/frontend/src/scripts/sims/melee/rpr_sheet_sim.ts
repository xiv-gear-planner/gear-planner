import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {ArcaneCircle, DeathsDesign} from "@xivgear/core/sims/buffs";
import {Ability, GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";

const slice: GcdAbility = {
    type: 'gcd',
    name: "Slice",
    id: 24373,
    potency: 320,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const waxingSlice: GcdAbility = {
    type: 'gcd',
    name: "Waxing Slice",
    id: 24374,
    potency: 400,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const infernalSlice: GcdAbility = {
    type: 'gcd',
    name: "Infernal Slice",
    id: 24375,
    potency: 500,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const SoD: GcdAbility = {
    type: 'gcd',
    name: "Shadow of Death",
    id: 24378,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [DeathsDesign]
};
const harpe: GcdAbility = {
    type: 'gcd',
    name: "Harpe",
    id: 24386,
    potency: 300,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 1.3
};
const unbuffedGallows: GcdAbility = {
    type: 'gcd',
    name: "Gallows",
    id: 24383,
    potency: 460,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const gibbet: GcdAbility = {
    type: 'gcd',
    name: "Gibbet",
    id: 24382,
    potency: 520,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const gallows: GcdAbility = {
    type: 'gcd',
    name: "Gallows",
    id: 24383,
    potency: 520,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const soulSlice: GcdAbility = {
    type: 'gcd',
    name: "Soul Slice",
    id: 24380,
    potency: 460,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
const pharvest: GcdAbility = {
    type: 'gcd',
    name: "Plentiful Harvest",
    id: 24385,
    potency: 1000,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const harvestMoon: GcdAbility = {
    type: 'gcd',
    name: "Harvest Moon",
    id: 24388,
    potency: 600,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 0,
};

const communio: GcdAbility = {
    type: 'gcd',
    name: "Communio",
    id: 24398,
    potency: 1100,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.3,
};
const unbuffedVoidReaping: GcdAbility = {
    type: 'gcd',
    name: "Void Reaping",
    id: 24395,
    potency: 460,
    attackType: "Weaponskill",
    gcd: 1.5,
    cast: 0
};
const voidReaping: GcdAbility = {
    type: 'gcd',
    name: "Void Reaping",
    id: 24395,
    potency: 520,
    attackType: "Weaponskill",
    gcd: 1.5,
    cast: 0
};
const crossReaping: GcdAbility = {
    type: 'gcd',
    name: "Cross Reaping",
    id: 24396,
    potency: 520,
    attackType: "Weaponskill",
    gcd: 1.5,
    cast: 0
};
const gluttony: OgcdAbility = {
    type: 'ogcd',
    name: "Gluttony",
    id: 24393,
    potency: 520,
    attackType: "Ability",
};
const unveiledGibbet: OgcdAbility = {
    type: 'ogcd',
    name: "Unveiled Gibbet",
    id: 24390,
    potency: 400,
    attackType: "Ability",
};
const unveiledGallows: OgcdAbility = {
    type: 'ogcd',
    name: "Unveiled Gallows",
    id: 24391,
    potency: 400,
    attackType: "Ability",
};
const lemuresSlice: OgcdAbility = {
    type: 'ogcd',
    name: "Lemure's Slice",
    id: 24399,
    potency: 240,
    attackType: "Ability",
};
const arcaneCircle: OgcdAbility = {
    type: 'ogcd',
    name: "Arcane Circle",
    id: 24405,
    activatesBuffs: [ArcaneCircle],
    potency: null,
    attackType: "Ability",
};

export interface RprSheetSimResult extends CycleSimResult {
}

interface RprNewSheetSettings extends SimSettings {

}

export interface RprNewSheetSettingsExternal extends ExternalCycleSettings<RprNewSheetSettings> {
}


export const rprSheetSpec: SimSpec<RprSheetSim, RprNewSheetSettingsExternal> = {
    stub: "rpr-sheet-sim",
    displayName: "RPR Sim",
    makeNewSimInstance: function (): RprSheetSim {
        return new RprSheetSim();
    },
    loadSavedSimInstance: function (exported: RprNewSheetSettingsExternal) {
        return new RprSheetSim(exported);
    },
    supportedJobs: ['RPR'],
    isDefaultSim: true
};

class RotationState {
    private _combo: number = 0;
    get combo() {
        return this._combo
    };

    set combo(newCombo) {
        this._combo = newCombo;
        if (this._combo >= 3) this._combo = 0;
    }

    private _soulGauge: number = 0;
    get soulGauge() {
        return this._soulGauge
    }

    set soulGauge(newGauge: number) {
        this._soulGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    private _shroudGauge: number = 0;
    get shroudGauge() {
        return this._shroudGauge
    }

    set shroudGauge(newGauge: number) {
        this._shroudGauge = Math.max(Math.min(newGauge, 100), 0);
    }

    oddShroudUsed: boolean = false;

    spendSoul() {
        if (this.soulGauge >= 50) {
            this.soulGauge -= 50;
        }

        this.shroudGauge += 10;
    }

    // CD/SoD refresh tracking
    cdTracker: CooldownTracker = new CooldownTracker();

    //We don't refresh SoD going into double enshroud, so we keep track of them
    // to stop refreshing after the 4th
    sodNumber = 0;

    nextGibGal = gallows.name;

    gibGalSwap() {
        if (this.nextGibGal == gallows.name) this.nextGibGal = gibbet.name;
        else this.nextGibGal = gallows.name;
    }

    spendSoulThreshold = 100;
}

class CooldownTracker {

    // Entries have the value [cooldown, timeLastUsed]
    lastUsedTimes: {
        [ability: string]: [number, number]
    } = {
        "Arcane Circle": [120, 0],
        "Gluttony": [60, 0],
        "Soul Slice": [30, 0],
    };

    sodCoverage: number = 0;

    use(cp: CycleProcessor, ability: Ability) {
        this.lastUsedTimes[ability.name][1] = cp.currentTime;
    }

    isOffCD(cp: CycleProcessor, ability: Ability): boolean {
        const abilityTime = this.lastUsedTimes[ability.name];
        return (cp.currentTime - abilityTime[1]) >= abilityTime[0];
    }

    remainingCd(cp: CycleProcessor, ability: Ability): number {
        const abilityTimes = this.lastUsedTimes[ability.name];
        return Math.max(0, abilityTimes[1] + abilityTimes[0] - cp.currentTime);
    }

    willBeUsableBeforeNextGcd(cp: CycleProcessor, ability: OgcdAbility): boolean {
        const abilityTimes = this.lastUsedTimes[ability.name];
        return (abilityTimes[1] + abilityTimes[0] + (ability.animationLock ?? STANDARD_ANIMATION_LOCK) < cp.nextGcdTime)
    }
}


export class RprSheetSim extends BaseMultiCycleSim<RprSheetSimResult, RprNewSheetSettings> {

    spec = rprSheetSpec;
    shortName = "rpr-sheet-sim";
    displayName = rprSheetSpec.displayName;
    manuallyActivatedBuffs = [ArcaneCircle];

    rotationState: RotationState = new RotationState();
    readonly comboActions: GcdAbility[] = [slice, waxingSlice, infernalSlice];

    constructor(settings?: RprNewSheetSettingsExternal) {
        super('RPR', settings);
    }

    makeDefaultSettings(): RprNewSheetSettings {
        return {};
    }


    useCombo(cp: CycleProcessor) {
        cp.useGcd(this.comboActions[this.rotationState.combo++]);
        this.rotationState.soulGauge += 10;
    }

    getGibGal(): [OgcdAbility, GcdAbility] {
        if (this.rotationState.nextGibGal == gallows.name) return [unveiledGallows, gallows];
        else return [unveiledGibbet, gibbet];
    }

    // Needs a weave slot in the gcd
    useGibGal(cp: CycleProcessor) {

        if (this.rotationState.soulGauge < 50) {
            console.error("Tried to use Gibbet/Gallows with <50 soul at " + cp.currentTime);
            return;
        }

        const toUse = this.getGibGal();
        cp.use(toUse[0]);
        cp.use(toUse[1]);

        this.rotationState.gibGalSwap();
        this.rotationState.soulGauge -= 50;
        this.rotationState.shroudGauge += 10;
    }

    useEnshroud(cp: CycleProcessor) {

        if (this.rotationState.shroudGauge < 50) {
            console.error("Tried to enter enshroud with < 50 shroud gauge at " + cp.currentTime.toString());
            return;
        }
        this.rotationState.shroudGauge -= 50;
        cp.useGcd(unbuffedVoidReaping);
        cp.useGcd(crossReaping);
        cp.useOgcd(lemuresSlice);
        cp.useGcd(voidReaping);
        cp.useGcd(crossReaping);
        cp.useOgcd(lemuresSlice);
        cp.useGcd(communio);
    }

    useDoubleEnshroudBurst(cp: CycleProcessor) {

        if (this.rotationState.shroudGauge < 50) {
            console.error("Tried to enter double shroud with < 50 shroud gauge at " + cp.currentTime);
            return;
        }
        this.rotationState.shroudGauge -= 50;

        cp.useGcd(unbuffedVoidReaping);
        this.useSoD(cp);
        cp.useGcd(crossReaping);
        this.useSoD(cp);
        this.useArcaneCircle(cp);
        cp.useGcd(voidReaping);
        cp.useOgcd(lemuresSlice);
        cp.useGcd(crossReaping);
        cp.useOgcd(lemuresSlice);
        cp.useGcd(communio);
        this.usePlentifulHarvest(cp);

        this.useEnshroud(cp);
        this.rotationState.sodNumber = 2;
        this.rotationState.oddShroudUsed = false;

    }

    useArcaneCircle(cp: CycleProcessor) {

        cp.useOgcd(arcaneCircle);
        this.rotationState.cdTracker.use(cp, arcaneCircle);
    }

    useSoD(cp: CycleProcessor) {
        cp.use(SoD);
        if (this.rotationState.cdTracker.sodCoverage === 0) {
            this.rotationState.cdTracker.sodCoverage = cp.currentTime;
        }
        this.rotationState.cdTracker.sodCoverage += 30;
        this.rotationState.sodNumber++;
    }

    useGluttony(cp: CycleProcessor) {

        if (this.rotationState.soulGauge < 50) {
            console.error("Tried to use Gluttony with <50 soul at " + cp.currentTime);
            return;
        }

        cp.useOgcd(gluttony);
        this.rotationState.cdTracker.use(cp, gluttony);
        this.rotationState.soulGauge -= 50;

        cp.useGcd(this.getGibGal()[1]);
        this.rotationState.gibGalSwap();
        cp.useGcd(this.getGibGal()[1]);
        this.rotationState.gibGalSwap();

        this.rotationState.shroudGauge += 20;
    }

    useSoulSlice(cp: CycleProcessor) {
        cp.useGcd(soulSlice);
        this.rotationState.cdTracker.lastUsedTimes[soulSlice.name][1] += 30;
        this.rotationState.soulGauge += 50;
    }

    usePlentifulHarvest(cp: CycleProcessor) {
        cp.useGcd(pharvest);
        this.rotationState.shroudGauge += 50;
    }

    // This function expects to be called immediately after a gcd is used.
    // Might not work right if used right after an ogcd
    useFiller(cp: CycleProcessor) {

        //This assumes that if we can weave gluttony, it will be the only weave.
        // If that's not the case then this needs to be revisited
        if (this.rotationState.cdTracker.willBeUsableBeforeNextGcd(cp, gluttony) &&
            this.rotationState.soulGauge >= 50) {

            cp.currentTime += this.rotationState.cdTracker.remainingCd(cp, gluttony);
            this.useGluttony(cp);
            this.rotationState.spendSoulThreshold = 150 - this.rotationState.spendSoulThreshold;
            return;
        }

        // use odd enshroud at some point when available
        if (this.rotationState.shroudGauge >= 50
            && !this.rotationState.oddShroudUsed
            && this.rotationState.cdTracker.remainingCd(cp, gluttony) > 8.5 + cp.stats.gcdPhys(cp.gcdBase)
            && this.rotationState.cdTracker.sodCoverage - cp.currentTime > 11) {

            this.useEnshroud(cp);
            this.rotationState.oddShroudUsed = true;
            return;
        }

        // If SS is available the gcd after next one, use unveiled > gibgal to not overcap
        if (cp.currentTime + this.rotationState.cdTracker.remainingCd(cp, soulSlice) < cp.nextGcdTime + cp.stats.gcdPhys(cp.gcdBase) &&
            this.rotationState.soulGauge >= 50) {
            this.useGibGal(cp);
            return;
        }

        // use SS if its off cd
        if (this.rotationState.cdTracker.isOffCD(cp, soulSlice)
            && this.rotationState.soulGauge <= 50) {
            this.useSoulSlice(cp);
            return;
        }

        // use SoD if off CD
        if (this.rotationState.cdTracker.sodCoverage - cp.currentTime < 30
            && this.rotationState.sodNumber <= 3) { // don't refresh SoD before double shroud

            this.useSoD(cp);
            return;
        }


        // Spend soul. We spend at 100 before odd gluttony to make sure we have enough gauge,
        // and then spend at 50 after odd gluttony to make sure we have shroud to do burst
        if (this.rotationState.soulGauge >= this.rotationState.spendSoulThreshold) {
            this.useGibGal(cp);
            return;
        }

        this.useCombo(cp);
    }


    getRotationsToSimulate(): Rotation[] {
        const sim = this;
        this.rotationState = new RotationState();
        return [{
            cycleTime: 120,

            /* I just used the cycle processor instead of doing any cycles, as doing so
             * would require me to duplicate all of the 'useX(cp)' functions for CycleContext
             * Is there a better way to do this?
            */
            apply(cp: CycleProcessor) {

                cp.useGcd(harpe);

                //Early shroud opener. Make customizable? (probably not worth unless we wanna sim downtime or very short KTs)
                //this.useSoD(cp);
                sim.useSoD(cp);
                cp.useOgcd(arcaneCircle);
                cp.useGcd(soulSlice);
                sim.rotationState.cdTracker.use(cp, soulSlice);
                sim.rotationState.soulGauge += 50;
                cp.useGcd(soulSlice);
                sim.rotationState.soulGauge += 50;
                sim.usePlentifulHarvest(cp);
                sim.useEnshroud(cp);

                // Do gluttony manually to insert the unbuffed gallows
                cp.use(gluttony);
                sim.rotationState.cdTracker.use(cp, gluttony);
                cp.use(unbuffedGallows);
                cp.use(gibbet);
                sim.rotationState.soulGauge -= 50;
                sim.rotationState.shroudGauge += 20;

                sim.useGibGal(cp);

                // 3 + 2*gcd + animlock is (2 reapings) + (gcd before enshroud and first Sod) + (animlock form 2nd SoD)
                while (cp.remainingGcdTime > 0 &&
                sim.rotationState.cdTracker.remainingCd(cp, arcaneCircle) > 9.6) {

                    sim.useFiller(cp);
                }

                sim.useCombo(cp);
                sim.useCombo(cp);

                while (cp.remainingGcdTime > 0) {
                    sim.useDoubleEnshroudBurst(cp);
                    if (sim.rotationState.combo !== 0) {
                        sim.useCombo(cp);
                    }
                    while (cp.remainingGcdTime > 0 &&
                    (sim.rotationState.cdTracker.remainingCd(cp, arcaneCircle) > 9.6
                        || sim.rotationState.shroudGauge < 50)) {

                        sim.useFiller(cp);
                    }
                }
            }

        }]
    }
} 