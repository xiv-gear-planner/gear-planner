import { SimSettings } from "../simulation";
import { BaseMultiCycleSim, CycleProcessor, CycleSimResult, DamageResult, ExternalCycleSettings } from "./sim_processors";
import { Ability, Buff, BuffController, GcdAbility, OgcdAbility } from "./sim_types"
import { BuffSettingsArea } from "./party_comp_settings";
import { cycleSettingsGui } from "./components/cycle_settings_components";
import { writeProxy } from "../util/proxies";
import { FieldBoundCheckBox, labeledCheckbox } from "../components/util";
import { OffGuardBuff } from "./buffs";
import { SwiftcastBuff } from "./common/swiftcast";
import { removeSelf } from "./common/utils";

/**
 * BLU spells that apply Bleeding
 */
const BLU_BLEED_SPELLS = [
    "Nightbloom",
    "Song of Torment",
    "Aetherial Spark"
] as const as readonly string[];

/**
 * BLU spells that deal physical damage
 */
const BLU_PHYSICAL_SPELLS = [
    "Flying Frenzy",
    "Drill Cannons",
    "Final Sting",
    "Sharpened Knife",
    "Flying Sardine",
    "4-tonze Weight",
    "Sticky Tongue",
    "Fire Angon",
    "Kaltstrahl",
    "Abyssal Transfixion",
    "Revenge Blast",
    "Triple Trident",
    "Peripheral Synthesis",
    "Goblin Punch",
    "Right Round",
    "Wild Rage",
    "Deep Clean",
    "Ruby Dynamics",
    "Winged Reprobation"
] as const as readonly string[];

/**
 * BLU abilities that are channeled attacks
 */
const BLU_CHANNELED_ABILITIES = [
    "Phantom Flurry",
    "Apokalypsis",
] as const as readonly string[];

/**
 * BLU personal buffs (limited subset)
 */

const Boost: Buff = {
    name: "Boost",
    job: "BLU",
    duration: 30,
    cooldown: 0,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.5 // only applies to damage spells
    },
    appliesTo: ability => ability.attackType === "Spell" && ability.potency !== null,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        // mutually exclusive with Harmonized
        buffController.removeStatus(Harmonized);
        buffController.removeSelf();
        return null;
    },
    statusId: 1716
}

const WaxingNocturne: Buff = {
    name: "Waxing Nocturne",
    job: "BLU",
    duration: 15,
    cooldown: 0,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.50
    },
    statusId: 1718
}

const MightyGuard: Buff = {
    name: "Mighty Guard",
    job: "BLU",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    cooldown: 0,
    selfOnly: true,
    effects: { // also changes the effects of certain BLU spells
        dmgIncrease: -0.4
    },
    statusId: 1719
}

const WaningNocturne: Buff = {
    name: "Waning Nocturne",
    job: "BLU",
    duration: 15,
    cooldown: 0,
    selfOnly: true,
    effects: {
        dmgIncrease: -1 // can't use any actions during Waning
    },
    statusId: 1727
}

const Harmonized: Buff = {
    name: "Harmonized",
    job: "BLU",
    duration: 30,
    cooldown: 0,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.8 // only applies to physical damage spells
    },
    appliesTo: ability => ability.attackType === "Spell" && BLU_PHYSICAL_SPELLS.includes(ability.name),
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        // mutually exclusive with Boost
        buffController.removeStatus(Boost);
        buffController.removeSelf();
        return null;
    },
    statusId: 2118
}

const TankMimicry: Buff = {
    name: "Aetheric Mimicry: Tank",
    job: "BLU",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    cooldown: 0,
    selfOnly: true,
    effects: {}, // changes the effects of certain BLU spells
    statusId: 2124
}

const DpsMimicry: Buff = {
    name: "Aetheric Mimicry: DPS",
    job: "BLU",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    cooldown: 0,
    selfOnly: true,
    effects: { // also changes the effects of certain BLU spells
        dhitChanceIncrease: 0.20,
        critChanceIncrease: 0.20
    },
    statusId: 2125
}

const HealerMimicry: Buff = {
    name: "Aetheric Mimicry: Healer",
    job: "BLU",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    cooldown: 0,
    selfOnly: true,
    effects: {}, // changes the effects of certain BLU spells
    statusId: 2126
}

const BrushWithDeath: Buff = {
    name: "Brush with Death",
    job: "BLU",
    duration: 600,
    cooldown: 0,
    selfOnly: true,
    effects: {}, // prevents certain BLU spells from being used
    statusId: 2127
}

const SurpanakhaBuff: Buff = {
    name: "Surpanakha's Fury",
    job: "BLU",
    duration: 3,
    cooldown: 0,
    selfOnly: true,
    effects: {
        // only applies to Surpanakha
        // dmgIncrease: 0.5, 1 stack
        // dmgIncrease: 1.0, 2 stacks
        // dmgIncrease: 1.5, 3 stacks
    },
    beforeSnapshot: removeSelf,
    appliesTo: ability => ability.name === "Surpanakha",
    statusId: 2130
}

const Tingling: Buff = {
    name: "Tingling",
    job: "BLU",
    duration: 15,
    cooldown: 0,
    selfOnly: true,
    effects: {
       // increases base potency of physical damage spells by 100 per hit
    },
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        if (ability.attackType === "Spell" && BLU_PHYSICAL_SPELLS.includes(ability.name)) {
            buffController.removeSelf();

            // Triple Trident hits 3 times, each hit gets bonus potency
            const bonusPotency: number = (ability.name === "Triple Trident") ? 300 : 100;

            // TODO: revisit if physical damage dot ability is added
            return {
                ...ability,
                potency: ability.potency + bonusPotency,
            }
        }
        return null;
    },
    statusId: 2492
}

const BasicInstinct: Buff = {
    name: "Basic Instinct",
    job: "BLU",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    cooldown: 0,
    selfOnly: true,
    effects: {
        dmgIncrease: 1.0
    },
    statusId: 2498
}

/**
 * BLU spells and abilities (limited subset)
 */

export const SongOfTorment: GcdAbility = {
    name: "Song of Torment",
    type: "gcd",
    attackType: "Spell",
    potency: 50,
    dot: {
        tickPotency: 50,
        duration: 30,
        id: 1714 // same effect as Nightbloom and Aetherial Spark (overwrites)
    },
    gcd: 2.5,
    cast: 2.0,
    id: 11386
}

export const Bristle: GcdAbility = {
    name: "Bristle",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    activatesBuffs: [Boost],
    gcd: 2.5,
    cast: 1.0,
    id: 11393
}

export const FinalSting: GcdAbility = {
    name: "Final Sting",
    type: "gcd",
    attackType: "Spell",
    potency: 2000,
    activatesBuffs: [BrushWithDeath],
    gcd: 2.5,
    cast: 2.0,
    id: 11407
}

export const OffGuard: OgcdAbility = {
    name: "Off-guard",
    type: "ogcd",
    attackType: "Spell", // TODO: cast and cooldown are reduced by spell speed
    potency: null,
    activatesBuffs: [OffGuardBuff],
    animationLock: 1.0, // TODO: should be cast time
    cooldown: {
        time: 60,
        reducedBy: "spellspeed"
    },
    id: 11411
}

const MoonFlute: GcdAbility = {
    name: "Moon Flute",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    activatesBuffs: [WaxingNocturne],
    gcd: 2.5,
    cast: 2.0,
    id: 11415
}

export const FeatherRain: OgcdAbility = {
    name: "Feather Rain",
    type: "ogcd",
    attackType: "Ability",
    potency: 220,
    dot: {
        tickPotency: 40,
        duration: 6,
        id: 1723
    },
    animationLock: 0.6,
    cooldown: {
        time: 30
    },
    id: 11426
}

export const ShockStrike: OgcdAbility = {
    name: "Shock Strike",
    type: "ogcd",
    attackType: "Ability",
    potency: 400,
    animationLock: 0.6,
    cooldown: {
        time: 60
    },
    id: 11429
}

export const GlassDance: OgcdAbility = {
    name: "Glass Dance",
    type: "ogcd",
    attackType: "Ability",
    potency: 350,
    animationLock: 0.6,
    cooldown: {
        time: 90
    },
    id: 11430
}

export const SonicBoom: GcdAbility = {
    name: "Sonic Boom",
    type: "gcd",
    attackType: "Spell",
    potency: 210,
    gcd: 2.5,
    cast: 1.0,
    id: 18308
}

export const Whistle: GcdAbility = {
    name: "Whistle",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    activatesBuffs: [Harmonized],
    gcd: 2.5,
    cast: 1.0,
    id: 18309
}

const Surpanakha: OgcdAbility = {
    name: "Surpanakha",
    type: "ogcd",
    attackType: "Ability",
    potency: 200,
    activatesBuffs: [SurpanakhaBuff],
    animationLock: 0.6,
    cooldown: {
        time: 30,
        charges: 4
    },
    id: 18323
}

export const Quasar: OgcdAbility = {
    name: "Quasar",
    type: "ogcd",
    attackType: "Ability",
    potency: 300,
    animationLock: 0.6,
    cooldown: {
        time: 60 // shared with J Kick
    },
    id: 18324
}

export const JKick: OgcdAbility = {
    name: "J Kick",
    type: "ogcd",
    attackType: "Ability",
    potency: 300,
    animationLock: 0.9,
    cooldown: {
        time: 60 // shared with Quasar
    },
    id: 18325
}

export const TripleTrident: GcdAbility = {
    name: "Triple Trident",
    type: "gcd",
    attackType: "Spell",
    potency: 450, // 3 hits @ 150 ea, 250 ea under Tingling
    gcd: 2.5,
    cast: 2.0,
    cooldown: {
        time: 90,
        reducedBy: "spellspeed"
    },
    id: 23264
}

export const Tingle: GcdAbility = {
    name: "Tingle",
    type: "gcd",
    attackType: "Spell",
    potency: 100,
    activatesBuffs: [Tingling],
    gcd: 2.5,
    cast: 2.0,
    id: 23265
}

export const FeculentFlood: GcdAbility = {
    name: "Feculent Flood",
    type: "gcd",
    attackType: "Spell",
    potency: 220,
    gcd: 2.5,
    cast: 2.0,
    id: 23271
}

export const RoseOfDestruction: GcdAbility = {
    name: "The Rose of Destruction",
    type: "gcd",
    attackType: "Spell",
    potency: 400,
    gcd: 2.5,
    cast: 2.0,
    cooldown: {
        time: 30,
        reducedBy: "spellspeed"
    },
    id: 23275
}

const MatraMagic: GcdAbility = {
    name: "Matra Magic",
    type: "gcd",
    attackType: "Spell",
    potency: 400, // 8 hits @ 50 ea, 100 ea under Aetheric Mimicry: DPS
    gcd: 2.5,
    cast: 2.0,
    cooldown: {
        time: 120,
        reducedBy: "spellspeed"
    },
    id: 23285
}

export const PhantomFlurry: OgcdAbility = {
    name: "Phantom Flurry",
    type: "ogcd",
    attackType: "Ability",
    potency: null,
    dot: {
        tickPotency: 200,
        duration: 18, // TODO: ticks once on use, and 1 tick per second afterwards for 6 total ticks over 5s
        id: 2502
    },
    animationLock: 0, // TODO: 5s channeled attack, prevents autos for duration
    cooldown: {
        time: 120
    },
    id: 23288
}

export const Nightbloom: OgcdAbility = {
    name: "Nightbloom",
    type: "ogcd",
    attackType: "Ability",
    potency: 400,
    dot: {
        tickPotency: 75,
        duration: 60,
        id: 1714 // same effect as Song of Torment and Aetherial Spark (overwrites)
    },
    animationLock: 0.6,
    cooldown: {
        time: 120
    },
    id: 23290
}

export const BreathofMagic: GcdAbility = {
    name: "Breath of Magic",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    dot: {
        tickPotency: 120,
        duration: 60,
        id: 3712
    },
    gcd: 2.5,
    cast: 2.0,
    id: 34567
}

const WingedReprobation: GcdAbility = {
    name: "Winged Reprobation",
    type: "gcd",
    attackType: "Spell",
    potency: 300, // 400 with 3 stacks
    gcd: 2.5,
    cast: 1.0,
    cooldown: {
        time: 90, // 90s cooldown after 3rd stack is consumed
        reducedBy: "spellspeed"
    },
    id: 34576
}

export const MortalFlame: GcdAbility = {
    name: "Mortal Flame",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    dot: {
        tickPotency: 40,
        duration: Number.MAX_VALUE, // infinite duration
        id: 3643
    },
    gcd: 2.5,
    cast: 2.0,
    id: 34579
}

export const SeaShanty: OgcdAbility = {
    name: "Sea Shanty",
    type: "ogcd",
    attackType: "Ability",
    potency: 500, // TODO: 1000 if weather is Rain, Showers, or Thunderstorms
    animationLock: 0.6,
    cooldown: {
        time: 120
    },
    id: 34580
}

const Apokalypsis: OgcdAbility = {
    name: "Apokalypsis",
    type: "ogcd",
    attackType: "Ability",
    potency: null,
    dot: {
        tickPotency: 140,
        duration: 33, // TODO: ticks once on use, and 1 tick per second afterwards for 11 total ticks over 10s
        id: 3644
    },
    animationLock: 0, // TODO: 10s channeled attack, prevents autos for duration
    cooldown: {
        time: 120 // shared with Being Mortal
    },
    id: 34581
}

export const BeingMortal: OgcdAbility = {
    name: "Being Mortal",
    type: "ogcd",
    attackType: "Ability",
    potency: 800,
    animationLock: 0.6,
    cooldown: {
        time: 120 // shared with Apokalypsis
    },
    id: 34582
}

const WaningInfo: OgcdAbility = { // dummy ability to insert info into timeline
    name: "-- Waning --",
    type: "ogcd",
    attackType: "Ability",
    potency: null,
    animationLock: 0
}

/**
 * BLU sim settings
 */
export interface BluSimSettings extends SimSettings {
    dpsMimicryEnabled: boolean;
    mightyGuardEnabled: boolean;
    basicInstinctEnabled: boolean;
}

/**
 * BLU rotation state
 */
class BluRotationState {
    // current base gcd recast
    gcdBase: number = 0;

    // current long (2.0s base) gcd cast
    longGcdCast: number = 0;

    // current short (1.0s base) gcd cast
    shortGcdCast: number = 0;

    // start of Moon Flute window
    fluteStart: number = 0;

    // end of current Bleed effect
    bleedEnd: number = 0;

    // Surpanakha stacks
    private _surpanakhaCounter: number = 0;
    get surpanakhaCounter() {
        return this._surpanakhaCounter;
    }
    set surpanakhaCounter(newSurpanakha) {
        this._surpanakhaCounter = newSurpanakha % 4;
    }

    // Winged Reprobation stacks
    private _wingedCounter: number = 0;
    get wingedCounter() {
        return this._wingedCounter;
    }
    set wingedCounter(newWinged) {
        this._wingedCounter = newWinged % 4;
    }
}

/**
 * BLU sim functions
 */
export abstract class BluSim<_BluCycleSimResult, _BluSimSettings, BluExternalCycleSettings extends ExternalCycleSettings<BluSimSettings>> 
    extends BaseMultiCycleSim<CycleSimResult, BluSimSettings> {
    
    manuallyActivatedBuffs = [SwiftcastBuff];
    rotationState: BluRotationState = new BluRotationState();

    constructor(settings?: BluExternalCycleSettings) {
        super("BLU", settings);
    }

    makeDefaultSettings(): BluSimSettings {
        return {
            dpsMimicryEnabled: true,
            mightyGuardEnabled: false,
            basicInstinctEnabled: false,
        };
    }

    makeConfigInterface(settings: BluSimSettings, updateCallback: () => void): HTMLElement {
        const configDiv = document.createElement("div");
        configDiv.appendChild(cycleSettingsGui(writeProxy(this.cycleSettings, updateCallback)));

        // insert BLU stance toggles
        const stancesDiv = document.createElement("div");
        const dpsMimicryCb = new FieldBoundCheckBox(settings, "dpsMimicryEnabled");
        stancesDiv.appendChild(labeledCheckbox("Aetheric Mimicry: DPS", dpsMimicryCb));
        const mightyGuardCb = new FieldBoundCheckBox(settings, "mightyGuardEnabled");
        stancesDiv.appendChild(labeledCheckbox("Mighty Guard", mightyGuardCb));
        const basicInstinctCb = new FieldBoundCheckBox(settings, "basicInstinctEnabled");
        stancesDiv.appendChild(labeledCheckbox("Basic Instinct", basicInstinctCb));
        
        configDiv.appendChild(stancesDiv);
        configDiv.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return configDiv;
    }

    abstract useOgcdFiller(cp: CycleProcessor): void;

    applyStances(cp: CycleProcessor) {
        if (this.settings.dpsMimicryEnabled) {
            cp.activateBuff(DpsMimicry);
        }

        // Basic Instinct overrides the damage penalty of Mighty Guard
        if (this.settings.mightyGuardEnabled) {
            const buff: Buff = {
                ...MightyGuard,
                effects: {
                    ...MightyGuard.effects,
                    dmgIncrease: this.settings.basicInstinctEnabled ? 0 : -0.4,
                }
            }
            cp.activateBuff(buff);
        }

        if (this.settings.basicInstinctEnabled) {
            cp.activateBuff(BasicInstinct);
        }
    }

    useFlute(cp: CycleProcessor) {
        cp.use(MoonFlute);
        this.rotationState.fluteStart = cp.currentTime;
        const waningStart = this.rotationState.fluteStart + WaxingNocturne.duration;
        cp.setBuffStartTime(WaningNocturne, waningStart);
    }

    doWaning(cp: CycleProcessor) {
        const waxingEnd = this.rotationState.fluteStart + WaxingNocturne.duration;
        const waningEnd = this.rotationState.fluteStart + WaxingNocturne.duration + WaningNocturne.duration;

        // advance to end of Waxing window
        cp.advanceTo(Math.max(cp.currentTime, Math.min(waxingEnd, cp.totalTime)), true);

        // insert informational entry into timeline
        if (waningEnd > cp.currentTime) {
            cp.use(WaningInfo);
        }

        // advance to end of Waning window
        cp.advanceTo(Math.max(cp.currentTime, Math.min(waningEnd, cp.totalTime)), true);

        // set next gcd time to end of Waning window
        if (cp.currentTime > cp.nextGcdTime) {
            cp.nextGcdTime = cp.currentTime;
        }
    }

    useBleed(cp: CycleProcessor, ability: Ability) {
        if (!("dot" in ability) || !BLU_BLEED_SPELLS.includes(ability.name)) {
            throw Error(`Ability ${ability.name} does not apply Bleeding.`);
        }
        
        cp.use(ability);
        this.rotationState.bleedEnd = cp.currentTime + ability.dot.duration;
    }

    // TODO: implement proper channeled ability support in sim processor
    useChanneled(cp: CycleProcessor, ability: Ability) {
        if (!BLU_CHANNELED_ABILITIES.includes(ability.name)) {
            throw Error(`Ability ${ability.name} is not a channeled attack.`);
        }

        // use the ability, then advance to the end of the channel time
        switch (ability.name) {
            case "Phantom Flurry": { // 5s channel time
                cp.use(ability);
                const endFlurry = cp.currentTime + 5;
                cp.advanceTo(Math.max(cp.currentTime, Math.min(endFlurry, cp.totalTime)), true);
                break;
            }
            case "Apokalypsis": { // 10s channel time
                cp.use(ability);
                const endApok = cp.currentTime + 10;
                cp.advanceTo(Math.max(cp.currentTime, Math.min(endApok, cp.totalTime)), true);
                break;
            }
            default: {
                throw Error(`Ability ${ability.name} does not have channel time information. This is a bug.`);
            }
        }

        // set next gcd time to end of the channel time
        if (cp.currentTime > cp.nextGcdTime) {
            cp.nextGcdTime = cp.currentTime;
        }
    }

    useMatra(cp: CycleProcessor) {
        cp.advanceTo(cp.nextGcdTime);
        const buffs = cp.getActiveBuffs();
        const ability: Ability = {
            ...MatraMagic,
            potency: buffs.includes(DpsMimicry) ? 800 : 400,
        }
        cp.use(ability);
    }

    useWinged(cp: CycleProcessor) {
        const ability: Ability = {
            ...WingedReprobation,
            potency: this.rotationState.wingedCounter < 3 ? 300 : 400,
            cooldown: {
                ...WingedReprobation.cooldown,
                time: this.rotationState.wingedCounter < 3 ? 0 : 90,
            }
        }
        cp.use(ability);
        this.rotationState.wingedCounter++;
    }

    useSurpanakha(cp: CycleProcessor) {
        // TODO: reset Surpanakha counter if any ability other than Surpanakha is used
        const multiplier = (this.rotationState.surpanakhaCounter + 1) * 0.5;
        const buff: Buff = {
            ...SurpanakhaBuff,
            effects: {
                dmgIncrease: multiplier,
            },
        }
        const ability: Ability = {
            ...Surpanakha,
            activatesBuffs: [buff],
            // animation lock becomes internal cooldown for back-to-back uses
            animationLock: this.rotationState.surpanakhaCounter < 3 ? 1.0 : 0.6,
        }
        cp.use(ability);
        this.rotationState.surpanakhaCounter++;
    }

    useStingCombo(cp: CycleProcessor) {
        cp.use(Whistle);
        this.useOgcdFiller(cp);
        cp.use(Tingle);
        this.useFlute(cp);
        cp.advanceTo(cp.nextGcdTime);
        const buffs = cp.getActiveBuffs();
        // if Brush with Death is active, cannot use Final Sting
        if (buffs.includes(BrushWithDeath)) {
            console.warn(`Ability ${FinalSting.name} cannot be used while ${BrushWithDeath.name} is active.`);
        }
        cp.use(FinalSting);
    }
}
