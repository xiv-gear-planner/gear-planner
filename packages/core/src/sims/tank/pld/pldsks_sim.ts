import {GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import * as Actions from './pld_actions_sks';
import * as Buffs from './pld_buffs_sks';
import { BaseMultiCycleSim } from "@xivgear/core/sims/processors/sim_processors";

// keys for Action records structures:
type PldEnum_GCD = "Fast" | "Riot" | "Royal" | "HS" | "HSHC" | "Atone" |
    "Supp" | "Sep" | "Gore" | "Conf" | "Faith" | "Truth" | "Valor";

type PldEnum_oGCD = "Exp" | "Cos" | "Imp" | "Honor" | "Int" | "FOF";

// self reminder: const != immutable, just a constant reference
const ActionRecordGCD: Record<PldEnum_GCD, GcdAbility> = {
    "Fast": Actions.FastBlade,
    "Riot": Actions.RiotBlade,
    "Royal": Actions.RoyalAuthority,
    "HS": Actions.HolySpirit,
    "HSHC": Actions.HolySpiritHardcast,
    "Atone": Actions.Atonement,
    "Supp": Actions.Supplication,
    "Sep": Actions.Sepulchre,
    "Gore": Actions.GoringBlade,
    "Conf": Actions.Confiteor,
    "Faith": Actions.BladeOfFaith,
    "Truth": Actions.BladeOfTruth,
    "Valor": Actions.BladeOfValor
};

const ActionRecordOgcd: Record<PldEnum_oGCD, OgcdAbility> = {
    "Exp": Actions.Expiacion,
    "Cos": Actions.CircleOfScorn,
    "Imp": Actions.Imperator,
    "Honor": Actions.BladeOfHonor,
    "Int": Actions.Intervene,
    "FOF": Actions.FightOrFlight
};

class PaladinStateSystem {
    // This simple class accepts the GCD that we performed
    // and updates the state of our filler
    A1Ready: number = 0b0001;
    A2Ready: number = 0b0010;
    A3Ready: number = 0b0100;

    comboState: number = 1;
    swordOath: number = 0;
    divineMight: boolean = false;

    performAction(GCDused: GcdAbility) {
        if (GCDused === ActionRecordGCD["Fast"]) {
            this.comboState = 2;
        } else if (GCDused === ActionRecordGCD["Riot"]) {
            if (this.comboState === 2)
                this.comboState = 3;
            else
                this.comboState = 0;
        } else if (GCDused === ActionRecordGCD["Royal"]) {
            if (this.comboState === 3) {
                this.comboState = 1;
                this.divineMight = true;
                this.swordOath = this.swordOath | this.A1Ready;
            } else
                this.comboState = 0;
        } else if (GCDused === ActionRecordGCD["HS"]) {
            // Consume Divine Might:
            this.divineMight = false;
        } else if (GCDused === ActionRecordGCD["Atone"]) {
            if (this.swordOath & this.A1Ready) {
                // Remove AtonementReady, Add Supplication Ready
                this.swordOath = (this.swordOath & ~this.A1Ready) | this.A2Ready;
            }
        } else if (GCDused === ActionRecordGCD["Supp"]) {
            if (this.swordOath & this.A2Ready) {
                // Remove Supplication Ready, Add Sepulchre Ready
                this.swordOath = (this.swordOath & ~this.A2Ready) | this.A3Ready;
            }
        } else if (GCDused === ActionRecordGCD["Sep"]) {
            if (this.swordOath & this.A3Ready) {
                // Remove Sepulchre Ready
                this.swordOath = (this.swordOath & (~this.A3Ready));
            }
        }
    }


    debugState() {
        console.log([this.comboState, this.swordOath, this.divineMight].toString());
    }
}

export interface PldSKSSheetSimResult extends CycleSimResult {
}

export interface PldSKSSheetSettings extends SimSettings {
    acknowledgeSKS: boolean,
    justMinimiseDrift: boolean,
    attempt9GCDAbove247: boolean,
    alwaysLateWeave: boolean,
    useHyperRobotPrecision: boolean,
    hardcastopener: boolean,
    burstOneGCDEarlier: boolean,
    avoidDoubleHS9s: boolean,
    disableBurnDown: boolean,
    perform12312OldPrio: boolean,
    use701potencies: boolean,
    hideCommentText: boolean,
    simulateMissing9th: boolean,
}

export interface PldSKSSheetSettingsExternal extends ExternalCycleSettings<PldSKSSheetSettings> {

}

export const pldSKSSheetSpec: SimSpec<PldSKSSheetSim, PldSKSSheetSettingsExternal> = {
    stub: "pldsks-sheet-sim",
    displayName: "PLD SKS Strats Sim",
    loadSavedSimInstance: function (exported: PldSKSSheetSettingsExternal) {
        return new PldSKSSheetSim(exported);
    },
    makeNewSimInstance: function (): PldSKSSheetSim {
        return new PldSKSSheetSim();
    },
    supportedJobs: ['PLD'],
    supportedLevels: [100],
    description: "Paladin w/SKS Strategy Simulator (DT 7.05)\n" +
        "A playground for trying different rotation ideas as they relate to PLD, at 2.50 GCD, and Faster!\n" +
        "Warning! Assert EXTREME caution when comparing different GCDs speeds. Mostly you should " +
        "use this Sim's options to compare approaches with the same GCD... if even that!",
    isDefaultSim: false,
    maintainers: [{
        name: 'Chromatophore',
        contact: [{
            type: 'discord',
            discordTag: 'chromatophore',
            discordUid: '240554238093164556'
        }]
    }]
};

class PldSKSCycleProcessor extends CycleProcessor {
    MyState: PaladinStateSystem;
    MySettings: PldSKSSheetSettings;

    teenyTinySafetyMargin: number = 0.01;
    largerSafetyMargin: number = 0.1;

    hideCommentText: boolean = false;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        // More settings interpretation stuff goes here
        this.MyState = new PaladinStateSystem();
    }

    CopyGCDAction(baseAction: GcdAbility, newPotency?: number): GcdAbility {
        const act: GcdAbility = {
            type: 'gcd',
            name: baseAction.name,
            id: baseAction.id,
            attackType: baseAction.attackType,
            potency: newPotency ? newPotency : baseAction.potency,
            gcd: baseAction.gcd,
            cast: baseAction.cast,
            activatesBuffs: baseAction.activatesBuffs
        };
        return act;
    }

    fofIsActive(atTime: number): boolean {
        const fofData = this.getActiveBuffData(Buffs.FightOrFlightBuff);
        if (fofData === null)
            return false;

        if (fofData.end > atTime)
            return true;
        else
            return false;
    }

    getFOFRemaining(): number {
        const fofData = this.getActiveBuffData(Buffs.FightOrFlightBuff);
        if (fofData === null)
            return 0;
        return fofData.end - this.nextGcdTime;
    }

    useOgcdInOrder(order: OgcdAbility[], idx: number): number {
        if (idx < order.length) {
            if (this.canUseWithoutClipping(order[idx])) {
                this.useOgcd(order[idx]);
                idx++;
            }
        }
        if (idx < order.length) {
            if (this.canUseWithoutClipping(order[idx])) {
                this.useOgcd(order[idx]);
                idx++;
            }
        }
        return idx;
    }

    useFiller(evenMinute: boolean, useOldPriority?: boolean, playForNineSafety?: boolean) {
        // During regular filler, we will always use a specific GCD based on our state
        let chosenAbility = ActionRecordGCD["Fast"];

        // if we are atonement ready, become supplication ready:
        // This top If statement is what optimises us for 3 GCDs in FOF
        // When we have SKS and expect a 9 GCD FOF, we will skip this aspect
        // The parameter, even_minute, will be true when we are approaching an even minute burst

        if (this.MyState.swordOath === this.MyState.A1Ready && evenMinute === false && !useOldPriority) {
            chosenAbility = ActionRecordGCD["Atone"];
        } else if (this.MyState.comboState !== 3) {
            if (this.MyState.comboState === 2)
                chosenAbility = ActionRecordGCD["Riot"];
            else
                chosenAbility = ActionRecordGCD["Fast"];
        } else {
            // If we are royal ready:

            // if play_for_nine_safety is on, let us divest ourselves of HS
            // early, in even minutes;
            // This makes 9 GCD fofs more likely, and has better parity now
            // that it + Supp have the same potency

            if (this.MyState.divineMight === true && evenMinute && playForNineSafety)
                chosenAbility = ActionRecordGCD["HS"];

            else if (this.MyState.swordOath === this.MyState.A1Ready)
                chosenAbility = ActionRecordGCD["Atone"];
            else if (this.MyState.swordOath === this.MyState.A2Ready)
                chosenAbility = ActionRecordGCD["Supp"];
            // Old priority has us HS last, new priority has us HS before Sepp
            else if (this.MyState.divineMight === true && !useOldPriority)
                chosenAbility = ActionRecordGCD["HS"];
            else if (this.MyState.swordOath === this.MyState.A3Ready)
                chosenAbility = ActionRecordGCD["Sep"];
            else if (this.MyState.divineMight === true && useOldPriority)
                chosenAbility = ActionRecordGCD["HS"];
            else if (this.MyState.swordOath === 0 && this.MyState.divineMight === false)
                chosenAbility = ActionRecordGCD["Royal"];
        }

        this.useGcd(chosenAbility);
    }

    useBurstFiller(prioritiseMelee: boolean, replace1WHc?: boolean) {
        let chosenAbility = ActionRecordGCD["Fast"];

        // We always Sepulchre if we have it:
        if (this.MyState.swordOath === this.MyState.A3Ready)
            chosenAbility = ActionRecordGCD["Sep"];

        // prioritise_melee blocks this check:
        else if (this.MyState.divineMight === true && !prioritiseMelee)
            chosenAbility = ActionRecordGCD["HS"];
        else if (this.MyState.swordOath === this.MyState.A1Ready)
            chosenAbility = ActionRecordGCD["Atone"];
        else if (this.MyState.swordOath === this.MyState.A2Ready)
            chosenAbility = ActionRecordGCD["Supp"];
        // When we prioritise_melee, only use HS if it is our last option
        else if (this.MyState.divineMight === true)
            chosenAbility = ActionRecordGCD["HS"];
        else if (this.MyState.swordOath === 0 && this.MyState.divineMight === false) {
            if (this.MyState.comboState === 3)
                chosenAbility = ActionRecordGCD["Royal"];
            else if (this.MyState.comboState === 2)
                chosenAbility = ActionRecordGCD["Riot"];
            else if (replace1WHc)
                chosenAbility = ActionRecordGCD["HSHC"];
        }

        this.useGcd(chosenAbility);
    }

    useOgcdLateWeave(ability: OgcdAbility, hyperPrecise?: boolean): AbilityUseResult {
        if (hyperPrecise)
            this.advanceTo(this.nextGcdTime - (STANDARD_ANIMATION_LOCK) - this.teenyTinySafetyMargin);
        else
            this.advanceTo(this.nextGcdTime - (STANDARD_ANIMATION_LOCK) - this.largerSafetyMargin);
        return this.useOgcd(ability);
    }

    override addSpecialRow(message: string, time?: number) {
        if (!this.hideCommentText)
            super.addSpecialRow(message, time);
    }

    override useGcd(ability: GcdAbility): AbilityUseResult {
        // Automatically update our state when we use a GCD:
        this.MyState.performAction(ability);
        //this.MyState.debugState();
        return super.useGcd(ability);
    }

    // Stolen from Ninja sim
    // Effectively just delays us to the time we can actually use our oGCD at the earliest in the window
    override useOgcd(ability: OgcdAbility): AbilityUseResult {
        // If an Ogcd isn't ready yet, but it can still be used without clipping, advance time until ready.
        if (this.canUseWithoutClipping(ability)) {
            const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
            if (this.totalTime > readyAt) {
                this.advanceTo(readyAt);
            }
        }
        // Only try to use the Ogcd if it's ready.
        return this.cdTracker.canUse(ability) ? super.useOgcd(ability) : null;
    }

    delayForOgcd(ability: OgcdAbility): AbilityUseResult {
        // Here we insist upon using it:
        const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
        if (this.totalTime > readyAt) {
            this.advanceTo(readyAt);
        }

        return super.useOgcd(ability);
    }
};

export class PldSKSSheetSim extends BaseMultiCycleSim<PldSKSSheetSimResult, PldSKSSheetSettings, PldSKSCycleProcessor> {

    makeDefaultSettings(): PldSKSSheetSettings {
        return {
            acknowledgeSKS: true,
            justMinimiseDrift: false,
            attempt9GCDAbove247: false,
            alwaysLateWeave: false,
            hardcastopener: true,
            useHyperRobotPrecision: false,
            burstOneGCDEarlier: false,
            avoidDoubleHS9s: true,
            disableBurnDown: false,
            perform12312OldPrio: false,
            use701potencies: false,
            hideCommentText: false,
            simulateMissing9th: false
        };
    };

    spec = pldSKSSheetSpec;
    shortName = "pld-sheet-sim";
    displayName = pldSKSSheetSpec.displayName;

    constructor(settings?: PldSKSSheetSettingsExternal) {
        super('PLD', settings);

    }

    protected createCycleProcessor(settings: MultiCycleSettings): PldSKSCycleProcessor {
        return new PldSKSCycleProcessor({
            ...settings,
            hideCycleDividers: true
        });
    }

    getRotationsToSimulate(): Rotation[] {
        const sim = this;

        //nb I stole most of this from the RPR sim

        return [{
            // Technically our lowest common cycle time for strategies that we would actually cycle
            // are like 14 minutes, lol:
            cycleTime: 60 * 14,


            apply(cp: PldSKSCycleProcessor) {

                const physGCD = cp.stats.gcdPhys(2.5);
                const magicGCD = cp.stats.gcdMag(2.5);

                // the GCD abilities are const references to ReadOnly types.
                // As such I'm pretty sure they are immutable, so
                // I will indeed need to make some kind of data structure to
                // reference them.

                // Reset Action Record:
                ActionRecordGCD["Fast"] = Actions.FastBlade;
                ActionRecordGCD["Riot"] = Actions.RiotBlade;
                ActionRecordGCD["Royal"] = Actions.RoyalAuthority;
                ActionRecordGCD["HS"] = Actions.HolySpirit;
                ActionRecordGCD["HSHC"] = Actions.HolySpiritHardcast;
                ActionRecordGCD["Atone"] = Actions.Atonement;
                ActionRecordGCD["Supp"] = Actions.Supplication;
                ActionRecordGCD["Sep"] = Actions.Sepulchre;
                ActionRecordGCD["Gore"] = Actions.GoringBlade;
                ActionRecordGCD["Conf"] = Actions.Confiteor;
                ActionRecordGCD["Faith"] = Actions.BladeOfFaith;
                ActionRecordGCD["Truth"] = Actions.BladeOfTruth;
                ActionRecordGCD["Valor"] = Actions.BladeOfValor;

                // Alter based on setting:
                if (sim.settings.use701potencies) {
                    // Filler potency changes:
                    ActionRecordGCD["Royal"] = cp.CopyGCDAction(Actions.RoyalAuthority, 440);
                    ActionRecordGCD["HS"] = cp.CopyGCDAction(Actions.HolySpirit, 470);
                    ActionRecordGCD["HSHC"] = cp.CopyGCDAction(Actions.HolySpiritHardcast, 370);
                    ActionRecordGCD["Atone"] = cp.CopyGCDAction(Actions.Atonement, 440);
                    ActionRecordGCD["Supp"] = cp.CopyGCDAction(Actions.Supplication, 460);
                    ActionRecordGCD["Sep"] = cp.CopyGCDAction(Actions.Sepulchre, 480);

                    // Burst potency changes:
                    ActionRecordGCD["Conf"] = cp.CopyGCDAction(Actions.Confiteor, 940);
                    ActionRecordGCD["Faith"] = cp.CopyGCDAction(Actions.BladeOfFaith, 740);
                    ActionRecordGCD["Truth"] = cp.CopyGCDAction(Actions.BladeOfTruth, 840);
                    ActionRecordGCD["Valor"] = cp.CopyGCDAction(Actions.BladeOfValor, 940);
                }

                let strategy250 = false;
                let strategy98Alt = false;
                let strategy98Force = false;
                let strategyAlways9 = false;
                let strategyMinimise = false;
                let strategySpecial250Late = true;
                const strategyHubris = (sim.settings.acknowledgeSKS === false);

                // Let's assume that we are going to do a fixed time window
                // optimisation, so, let's have an actual opener

                // A fixed time window is favourable to the perception of SKS
                // as even minimal delays to burst on an *infinite* dummy translate
                // to DPS losses that kinda do not exist in situations where you never
                // actually lose a usage: over *infinte* time, even a 0.1s delay
                // means you *eventually* lose a usage.

                cp.addSpecialRow(`Phys GCD is: ${physGCD}`);

                // (Setting this here will ensure the phys GCD comment is still always shown)
                cp.hideCommentText = sim.settings.hideCommentText;
                cp.addSpecialRow(`Magic GCD is: ${magicGCD}`);
                cp.addSpecialRow(`Selected Strategy:`);

                // However, if we are going to pretend SKS does not exist
                // (or, SKS does in fact not exist), we don't need this:
                if (physGCD > 2.49 && !strategyHubris) {
                    if (sim.settings.alwaysLateWeave) {
                        cp.addSpecialRow(`Late Weaving FOF at 2.50, OK! (Override)`);
                        strategyAlways9 = true;
                        strategySpecial250Late = false;
                    } else {
                        cp.addSpecialRow(`No SKS to consider due to 2.5 GCD`);
                        strategy250 = true;
                    }
                } else if (strategyHubris) {
                    cp.addSpecialRow(``);
                    cp.addSpecialRow(`SKS Rotations are disabled.`);
                    cp.addSpecialRow(`Sim will DELIBERATELY CLIP GCD`);
                    cp.addSpecialRow(`due intentionally playing as though 2.5`);
                    cp.addSpecialRow(``);
                    cp.addSpecialRow(`Gives a baseline for when no sks opti`);
                    cp.addSpecialRow(`is performed for given Total Time.`);
                    cp.addSpecialRow(``);
                    strategy250 = true;
                }  else if (physGCD > 2.46 || sim.settings.justMinimiseDrift) {
                    // We then have a variety of things to consider.
                    // at 2.47 and above, PLD is unlikely to achieve a 9 GCD FOF
                    // So we don't try, and instead aim to minimise buff drift
                    if (sim.settings.justMinimiseDrift) {
                        cp.addSpecialRow(`Just minimising drift, use FOF on CD always`);
                        strategyMinimise = true;
                    } else if (sim.settings.alwaysLateWeave === true) {  // However we have setting over rides to force our hand:
                        cp.addSpecialRow(`Late FOF w/2.43+ GCD (Override)`);
                        cp.addSpecialRow(`(+personal pps, --alignment & big drift)`);
                        strategyAlways9 = true;
                    } else if (sim.settings.attempt9GCDAbove247 === true) {
                        cp.addSpecialRow(`9/8 FOF w/2.47+ GCD (Override)`);
                        strategy98Alt = true;
                    } else {
                        cp.addSpecialRow(`2.47+ GCD, aim to minimise drift`);
                        strategyMinimise = true;
                    }
                } else if (physGCD > 2.42) {
                    // At 2.43 to 2.46, it should be possible to alternate a 9 GCD and an 8 GCD
                    // FOF to minimise drift, and just get a little extra from party buffs
                    // It's so, so little though, lol.
                    // 2.43 specifically is cursed:
                    if (physGCD < 2.44) {
                        cp.addSpecialRow(`2.43 Phys GCD is particularly challenging.`);
                        cp.addSpecialRow(`It either delays fof significantly`);
                        cp.addSpecialRow(`or risks clipping it's GCD to do 9/8`);

                        if (sim.settings.alwaysLateWeave) {
                            strategyAlways9 = true;
                            cp.addSpecialRow(`Late FOF w/2.43 GCD (Override)`);
                            cp.addSpecialRow(`(+personal pps, -buff alignment`);
                        } else {
                            strategy98Alt = true;
                            strategy98Force = true;
                            cp.addSpecialRow(`Presenting CLIP strat (+buff alignment, -potency)`);
                            cp.addSpecialRow(`(consider the 'always late' sim option)`);
                        }
                    } else {
                        // If we're 2.44 - 2.46
                        if (sim.settings.alwaysLateWeave === true) {
                            cp.addSpecialRow(`Late FOF w/2.43+ GCD (Override)`);
                            cp.addSpecialRow(`(+personal pps, -buff alignment)`);
                            strategyAlways9 = true;
                        } else {
                            cp.addSpecialRow(`2.44-2.46 GCD, alternating 9/8 FOFs`);
                            cp.addSpecialRow(`(+buff alignment, low drift)`);
                            strategy98Alt = true;
                        }
                    }
                } else if (physGCD > 2.36) {  // Otherwise, if our GCD is 2.37 - 2.42 We will always late weave FOF:
                    cp.addSpecialRow(`Always Late FOF at 2.37+ GCD`);
                    strategyAlways9 = true;
                } else { // Below that, things get weird, so let's just rely on the sim's override options:
                    cp.addSpecialRow(`Phys GCD very low! Use Overrides to trial behavior:`);
                    if (sim.settings.alwaysLateWeave === true) {
                        cp.addSpecialRow(`Always late override, Late FOFs`);
                        strategyAlways9 = true;
                    } else if (sim.settings.attempt9GCDAbove247 === true) {
                        cp.addSpecialRow(`9/8 Override, will late weave evens`);
                        strategy98Alt = true;
                    } else {
                        cp.addSpecialRow(`No Overrides, Minimizing Drift`);
                        strategyMinimise = true;
                    }
                }

                if (!strategy250 && physGCD !== 2.50) {
                    cp.addSpecialRow("");
                    cp.addSpecialRow("This strategy will delay FOF in some way");
                    cp.addSpecialRow("Big delays = misalign from party buffs");
                    cp.addSpecialRow("Big delays = potential lost usage");
                    cp.addSpecialRow("Check bottom of chart for delay summary!");
                    cp.addSpecialRow("Add appropriate party buffs in settings.");
                    cp.addSpecialRow("");
                    if (strategyAlways9 || strategy98Alt) {
                        cp.addSpecialRow("The Final Burst GCD of FOF may not fit IRL");
                        cp.addSpecialRow("depending on your ping, fps & precision");
                        cp.addSpecialRow("");
                    }

                    if (sim.settings.avoidDoubleHS9s) {
                        cp.addSpecialRow("(option) Rotation will Prio HS before Atone");
                        cp.addSpecialRow("on the approach to late weave fofs. This");
                        cp.addSpecialRow("avoids early & double HSs in them");
                        cp.addSpecialRow("(+margin, -small potency)");
                        cp.addSpecialRow("");
                    }

                    if (sim.settings.useHyperRobotPrecision) {
                        cp.addSpecialRow("(option) late FOFs will be used with");
                        cp.addSpecialRow("incredible precision of 0.01s");
                        cp.addSpecialRow("");
                    } else {
                        cp.addSpecialRow("(option) delayed FOF Late weaves will be");
                        cp.addSpecialRow("used 0.1s before the late weave limit.");
                        cp.addSpecialRow("");
                    }
                }

                if (sim.settings.perform12312OldPrio) {
                    cp.addSpecialRow("(option) The Use Endwalker Prio setting is ON");
                    cp.addSpecialRow("");
                }
                if (sim.settings.simulateMissing9th) {
                    cp.addSpecialRow("(option) Sim will play thinking it will get the");
                    cp.addSpecialRow("9th GCD in, but, it will miss the buff.");
                    cp.addSpecialRow("(Shows cost of strategy if not possible IRL)");
                    cp.addSpecialRow("");
                }

                if (strategyAlways9 && strategySpecial250Late) {
                    cp.addSpecialRow(`>> Always 9 GCD FOF: Hold Atonement`);
                }
                // We will not set our loop up to attempt a special first burst
                // and juse use things as early as possible after the '3rd' GCD


                // Standard opener:
                if (sim.settings.hardcastopener)
                    cp.useGcd(ActionRecordGCD["HSHC"]);
                cp.useGcd(ActionRecordGCD["Fast"]);
                cp.useGcd(ActionRecordGCD["Riot"]);
                if (!sim.settings.burstOneGCDEarlier) {
                    cp.useGcd(ActionRecordGCD["Royal"]);
                } else {
                    cp.addSpecialRow(">> Override: Bursting 1 GCD earlier");
                }

                let safety = 0;
                let evenMinute = true;
                let forceNextBurst = false;

                let onlyCosOnceInFiller = true;
                let onlyExpOnceInFiller = true;

                // Number cruncing stuff:
                let fofsUsed = 0;
                let timeOfFirstFof = 0;
                let timeOfLastFof = 0;
                let endOfTimeBurn = false;
                let fofDelayTrackerNext = 0;

                let clipTotalTime = 0;

                while ((cp.remainingGcdTime > 0) && (safety < 100000)) {
                    // While loops with no safety clause!
                    safety++;

                    if (strategyMinimise || strategy98Alt || strategyHubris) {
                        // if we are forcing 9/8s, we can't rely on canUseWithoutClipping
                        // this is because: we will clip, lol.
                        // We also want to provide feedback on if we delayed FOF across a GCD

                        const readyAt = fofDelayTrackerNext;
                        const nextEarly = cp.nextGcdTime + STANDARD_ANIMATION_LOCK;
                        // note that this is the going to delay up to the earliest weave after the next GCD:
                        if (readyAt > cp.currentTime && readyAt < (nextEarly)) {
                            // If this is going to collide with the next GCD, we want to know about it

                            // If we are forcing 98s and this is an even minute, we will get our awareness
                            // elsewhere:
                            if ((strategy98Force && evenMinute))
                                forceNextBurst = true;
                            else {
                                const isAfterLateWeaveLimit = (readyAt > (cp.nextGcdTime - STANDARD_ANIMATION_LOCK));
                                const isAfterNextGcd = readyAt > cp.nextGcdTime;
                                // Otherwise, add to the log what we are doing:
                                if (isAfterLateWeaveLimit) {
                                    if (strategyHubris) {
                                        cp.addSpecialRow(">> FOF comes up in " + (readyAt - cp.currentTime).toFixed(2) + "s");
                                        if (isAfterNextGcd) {
                                            cp.addSpecialRow(">> This is after the next GCD.");
                                            cp.addSpecialRow(">> A non-sks inclined player likely uses the GCD");
                                            cp.addSpecialRow(">> Delaying FOF by " + (nextEarly - readyAt).toFixed(2) + "s");
                                        } else {
                                            cp.addSpecialRow(">> Clipping once available!");
                                            cp.advanceTo(readyAt);
                                            forceNextBurst = true;
                                        }
                                    } else
                                        cp.addSpecialRow(">> Delaying FOF " + (nextEarly - readyAt).toFixed(2) + "s across GCD...", readyAt);
                                }
                            }
                        }


                    }

                    if (cp.canUseWithoutClipping(ActionRecordOgcd["FOF"]) || forceNextBurst) {

                        if (strategy250 || strategyMinimise) {
                            if (strategyMinimise)
                                cp.addSpecialRow(`>> Using FOF ASAP`);
                            cp.useOgcd(ActionRecordOgcd["FOF"]);
                        } else {
                            // Should we try to late weave?
                            // DANGER DANGER: Magic number:
                            //let fof_is_not_early = cp.cdTracker.statusOf(ActionRecord_oGCD["FOF"]).readyAt.relative > 1.0;

                            // if we are on an even minute, and we're 98ing
                            if ((strategy98Alt && evenMinute) || strategyAlways9) {
                                const readyAt = fofDelayTrackerNext;
                                cp.addSpecialRow(`>> FOF Ready, Late Weaving FOF!`, readyAt);
                                // if force is on, we are here because we are clipping our GCD:
                                if (strategy98Force) {
                                    if (!cp.canUseWithoutClipping(ActionRecordOgcd["FOF"])) {
                                        const beforeGCD = cp.nextGcdTime;
                                        cp.delayForOgcd(ActionRecordOgcd["FOF"]);
                                        const clipAmount = cp.nextGcdTime - beforeGCD;
                                        cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clipAmount).toFixed(2) + "s");
                                        clipTotalTime += clipAmount;
                                    } else {
                                        cp.useOgcdLateWeave(ActionRecordOgcd["FOF"], sim.settings.useHyperRobotPrecision);
                                    }

                                } else {
                                    // a normal late weave is fine:
                                    cp.useOgcdLateWeave(ActionRecordOgcd["FOF"], sim.settings.useHyperRobotPrecision);
                                }
                                if (fofsUsed !== 0) {
                                    const fofUsedTime = cp.currentTime - STANDARD_ANIMATION_LOCK;
                                    const delayedBy = fofUsedTime - readyAt;

                                    cp.addSpecialRow(`>> Delay to FOF: ` + (delayedBy).toFixed(2) + `s`, fofUsedTime);
                                }
                            } else {
                                cp.addSpecialRow(`Using FOF ASAP`);
                                cp.useOgcd(ActionRecordOgcd["FOF"]);
                            }
                        }

                        fofDelayTrackerNext = cp.cdTracker.statusOf(ActionRecordOgcd["FOF"]).readyAt.absolute;

                        if (fofsUsed === 0)
                            timeOfFirstFof = cp.currentTime;
                        fofsUsed++;
                        timeOfLastFof = cp.currentTime;


                        let oGCDcounter = 0;

                        // TODO: Intervene will be available earlier than other other oGCDs after a certain point:
                        const ogcdOrder = [ActionRecordOgcd["Imp"], ActionRecordOgcd["Cos"], ActionRecordOgcd["Exp"],
                            ActionRecordOgcd["Int"], ActionRecordOgcd["Int"]];

                        /////////////////
                        // We have now entered burst: perform all burst actions:

                        // Sks Pattern Detection:
                        if (strategy250 || strategyHubris || cp.canUseWithoutClipping(ActionRecordOgcd["Imp"])) {
                            // In this case, we definitely haven't late weaved
                            // Set counter to 1, as we will have already used our burst first oGCD
                            oGCDcounter = 1;

                            if (strategyHubris) {
                                let isGonnaClip = false;
                                const beforeGCD = cp.nextGcdTime;
                                // If we're specifically pretending SKS doesn't exist, delay for Req+
                                if (!cp.canUseWithoutClipping(ActionRecordOgcd["Imp"]))
                                    isGonnaClip = true;

                                cp.delayForOgcd(ActionRecordOgcd["Imp"]);

                                if (isGonnaClip) {
                                    const clipAmount = cp.nextGcdTime - beforeGCD;
                                    cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clipAmount).toFixed(2) + "s");
                                    clipTotalTime += clipAmount;
                                }

                            } else {
                                cp.useOgcd(ActionRecordOgcd["Imp"]);
                            }
                        } else {
                            // we could not use imperator before, so we must melee first GCD
                            // The easiest way to check this is simply, is oGCDcounter 1 or not?
                        }

                        // In this situation, we have given ourselves the req buff in the same
                        // weave window as FOF.
                        // This seems like a weird way to discern this but it makes it easier
                        // to steer the strategy_minimise pathway down here:

                        if (oGCDcounter === 1) {
                            // This burst is suggested to start blades early, to help avoid
                            // a situation where we lose BladeOfHonor due to phasing/death etc
                            cp.useGcd(ActionRecordGCD["Conf"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Faith"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Truth"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Valor"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useOgcd(ActionRecordOgcd["Honor"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Gore"]);
                        } else {
                            // In this situation, we have not yet been able to give ourselves
                            // req stacks. We *may* have late weaved FOF:
                            cp.useGcd(ActionRecordGCD["Gore"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Conf"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Faith"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Truth"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecordGCD["Valor"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useOgcd(ActionRecordOgcd["Honor"]);
                        }

                        // How much longer is actually left on FOF?

                        // Use any further ogcds, and burn down to when we only have time for
                        // 1 more GCD
                        let prioritiseMelee = true;
                        if (strategyAlways9 || (strategy98Alt && evenMinute))
                            prioritiseMelee = true;

                        oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);

                        let enoughTimeIfMelee = cp.fofIsActive((cp.nextGcdTime + physGCD));
                        let fofRemaining = cp.getFOFRemaining().toFixed(2);

                        let burstGCDsUsed = 0;

                        while (enoughTimeIfMelee && safety < 100000) {
                            safety++;
                            // Note the current status:
                            if (!strategy250)
                                cp.addSpecialRow(`>> FOF: ${fofRemaining}s, phys prio`);
                            // Use a burst GCD
                            cp.useBurstFiller(prioritiseMelee && (!sim.settings.perform12312OldPrio));
                            // Use any remaining oGCDs:
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            // Count how many GCDs we have now used:
                            burstGCDsUsed++;

                            // Update our variables:
                            enoughTimeIfMelee = cp.fofIsActive((cp.nextGcdTime + physGCD));
                            fofRemaining = cp.getFOFRemaining().toFixed(3);

                            if (strategyMinimise && burstGCDsUsed === 2) {
                                enoughTimeIfMelee = false;
                            }

                            // Fix 'time runs out in middle of burst' infinite loop:
                            if (cp.remainingGcdTime === 0)
                                enoughTimeIfMelee = false;
                        }

                        if (!strategy250)
                            cp.addSpecialRow(`>> Final burst GCD margin: ${fofRemaining}s:`);
                        else
                            cp.addSpecialRow(`>> Final burst GCD:`);

                        if (sim.settings.simulateMissing9th && burstGCDsUsed === 3) {
                            cp.advanceTo(cp.nextGcdTime);
                            cp.addSpecialRow(`>> (option) Simming this GCD misses FOF:`);
                            cp.removeBuff(Buffs.FightOrFlightBuff);
                        }
                        cp.useBurstFiller(false);

                        onlyCosOnceInFiller = true;
                        onlyExpOnceInFiller = true;

                        // Our buffs have expired, burst is complete:
                        // Flip even minute state:
                        evenMinute = !evenMinute;
                        forceNextBurst = false;

                        if (strategy98Alt) {
                            if (evenMinute)
                                cp.addSpecialRow(`>> 9/8 Even min: Hold Atonement`);
                            else
                                cp.addSpecialRow(`>> 9/8 Odd min: Spend Atonement`);
                        }
                    }

                    // If there are fewer than 20 seconds remaining in the user selected
                    // time window:
                    if (cp.remainingTime < 20 && !endOfTimeBurn && !sim.settings.disableBurnDown) {
                        cp.addSpecialRow("Less than 20s remain on sim!");
                        cp.addSpecialRow("Will now burn GCD resources.");
                        cp.addSpecialRow("Replace new combo w/HS in last 3 GCDs");
                        endOfTimeBurn = true;
                    }

                    // This is the bit where we just use filler:
                    if (endOfTimeBurn) {
                        // we also replace 1s with hardcasts under 3 phys GCDs, preventing a new combo starting
                        cp.useBurstFiller(false, cp.remainingGcdTime < (physGCD * 3));
                    } else
                        cp.useFiller((evenMinute && strategy98Alt) || (strategyAlways9 && strategySpecial250Late),
                            sim.settings.perform12312OldPrio, sim.settings.avoidDoubleHS9s);

                    // There are some circumstances where eg 2.47 will have these come off of
                    // cd when messing with FOF. Let's only use them once between bursts.
                    // Also: technically someone playing with hubris would clip these, too:
                    if (cp.canUseWithoutClipping(ActionRecordOgcd["Cos"]) && onlyCosOnceInFiller) {
                        cp.useOgcd(ActionRecordOgcd["Cos"]);
                        onlyCosOnceInFiller = false;
                        if (strategyHubris) {
                            const beforeGCD = cp.nextGcdTime;
                            cp.delayForOgcd(ActionRecordOgcd["Exp"]);
                            if ((cp.nextGcdTime - beforeGCD) > 0) {
                                const clipAmount = cp.nextGcdTime - beforeGCD;
                                cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clipAmount).toFixed(2) + "s");
                                clipTotalTime += clipAmount;
                            }
                            onlyExpOnceInFiller = false;
                        }
                    }
                    if (cp.canUseWithoutClipping(ActionRecordOgcd["Exp"]) && onlyExpOnceInFiller) {
                        cp.useOgcd(ActionRecordOgcd["Exp"]);
                        onlyExpOnceInFiller = false;
                    }
                }

                const fofDelta = (timeOfLastFof - timeOfFirstFof) - ((fofsUsed - 1) * 60);
                const averageDelayFof = fofDelta / (fofsUsed - 1);

                cp.addSpecialRow(">> Summaries:");

                cp.addSpecialRow("Number of FOFs: " + fofsUsed.toFixed(0));
                cp.addSpecialRow("Net FOF delay by end: " + fofDelta.toFixed(2));
                cp.addSpecialRow("Average delay: " + averageDelayFof.toFixed(2));
                if (averageDelayFof > 0.01) {
                    const threeGcdDelay = 7.5 / averageDelayFof;
                    cp.addSpecialRow("Burst hits 7.5s delay @ ~" + threeGcdDelay.toFixed(0) + "m");
                    cp.addSpecialRow("Delay interacts with Party Buffs.");
                }
                if (clipTotalTime > 0.01) {
                    cp.addSpecialRow("! ALERT !: Total clip time: " + clipTotalTime.toFixed(2) + "s");
                    cp.addSpecialRow("Avg of " + ((clipTotalTime / cp.currentTime) * 60).toFixed(2) + "s Clip every min");
                }
            }

        }];
    }

}
