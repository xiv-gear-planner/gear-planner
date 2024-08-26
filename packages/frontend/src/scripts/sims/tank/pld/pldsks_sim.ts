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
import {BaseMultiCycleSim} from "../../sim_processors";
import * as Actions from './pld_actions_sks';
import * as Buffs from './pld_buffs_sks';
import {FieldBoundCheckBox, labeledCheckbox, labelFor} from "@xivgear/common-ui/components/util";

// keys for Action records structures:
type PldEnum_GCD = "Fast" | "Riot" | "Royal" | "HS" | "HSHC" | "Atone" |
    "Supp" | "Sep" | "Gore" | "Conf" | "Faith" | "Truth" | "Valor";

type PldEnum_oGCD = "Exp" | "Cos" | "Imp" | "Honor" | "Int" | "FOF";

// self reminder: const != immutable, just a constant reference
const ActionRecord_GCD: Record<PldEnum_GCD, GcdAbility> = {
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
}

const ActionRecord_oGCD: Record<PldEnum_oGCD, OgcdAbility> = {
    "Exp": Actions.Expiacion,
    "Cos": Actions.CircleOfScorn,
    "Imp": Actions.Imperator,
    "Honor": Actions.BladeOfHonor,
    "Int": Actions.Intervene,
    "FOF": Actions.FightOrFlight
}

class PaladinStateSystem {
    // This simple class accepts the GCD that we performed
    // and updates the state of our filler
    A1Ready: number = 0b0001;
    A2Ready: number = 0b0010;
    A3Ready: number = 0b0100;

    combo_state: number = 1;
    sword_oath: number = 0;
    divine_might: boolean = false;

    perform_action(GCDused: GcdAbility) {
        if (GCDused == ActionRecord_GCD["Fast"]) {
            this.combo_state = 2;
        }
        else if (GCDused == ActionRecord_GCD["Riot"]) {
            if (this.combo_state == 2)
                this.combo_state = 3;
            else
                this.combo_state = 0;
        }
        else if (GCDused == ActionRecord_GCD["Royal"]) {
            if (this.combo_state == 3) {
                this.combo_state = 1;
                this.divine_might = true;
                this.sword_oath = this.sword_oath | this.A1Ready
            }
            else
                this.combo_state = 0;
        }
        else if (GCDused == ActionRecord_GCD["HS"]) {
            // Consume Divine Might:
            this.divine_might = false;
        }
        else if (GCDused == ActionRecord_GCD["Atone"]) {
            if (this.sword_oath & this.A1Ready) {
                // Remove AtonementReady, Add Supplication Ready
                this.sword_oath = (this.sword_oath & ~this.A1Ready) | this.A2Ready;
            }
        }
        else if (GCDused == ActionRecord_GCD["Supp"]) {
            if (this.sword_oath & this.A2Ready) {
                // Remove Supplication Ready, Add Sepulchre Ready
                this.sword_oath = (this.sword_oath & ~this.A2Ready) | this.A3Ready;
            }
        }
        else if (GCDused == ActionRecord_GCD["Sep"]) {
            if (this.sword_oath & this.A3Ready) {
                // Remove Sepulchre Ready
                this.sword_oath = (this.sword_oath & (~this.A3Ready));
            }
        }
    }


    debugState() {
        console.log([this.combo_state, this.sword_oath, this.divine_might].toString());
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
        }],
    }]
};

class PldSKSCycleProcessor extends CycleProcessor {
    MyState: PaladinStateSystem;
    MySettings: PldSKSSheetSettings;

    teeny_tiny_safety_margin: number = 0.01
    larger_safety_margin: number = 0.1;

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
        }
        return act;
    }

    fofIsActive(atTime: number): boolean {
        const fofData = this.getActiveBuffData(Buffs.FightOrFlightBuff);
        if (fofData == null)
            return false;

        if (fofData.end > atTime)
            return true;
        else
            return false;
    }

    getFOFRemaining(): number {
        const fofData = this.getActiveBuffData(Buffs.FightOrFlightBuff);
        if (fofData == null)
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

    useFiller(even_minute: boolean, use_old_priority?: boolean, play_for_nine_safety?: boolean) {
        // During regular filler, we will always use a specific GCD based on our state
        let chosen_ability = ActionRecord_GCD["Fast"];

        // if we are atonement ready, become supplication ready:
        // This top If statement is what optimises us for 3 GCDs in FOF
        // When we have SKS and expect a 9 GCD FOF, we will skip this aspect
        // The parameter, even_minute, will be true when we are approaching an even minute burst

        if (this.MyState.sword_oath == this.MyState.A1Ready && even_minute == false && !use_old_priority) {
            chosen_ability = ActionRecord_GCD["Atone"];
        }
        else if (this.MyState.combo_state != 3) {
            if (this.MyState.combo_state == 2)
                chosen_ability = ActionRecord_GCD["Riot"];
            else
                chosen_ability = ActionRecord_GCD["Fast"];
        }
        else {
            // If we are royal ready:

            // if play_for_nine_safety is on, let us divest ourselves of HS
            // early, in even minutes;
            // This makes 9 GCD fofs more likely, and has better parity now
            // that it + Supp have the same potency

            if (this.MyState.divine_might == true && even_minute && play_for_nine_safety)
                chosen_ability = ActionRecord_GCD["HS"];

            else if (this.MyState.sword_oath == this.MyState.A1Ready)
                chosen_ability = ActionRecord_GCD["Atone"];
            else if (this.MyState.sword_oath == this.MyState.A2Ready)
                chosen_ability = ActionRecord_GCD["Supp"];
            // Old priority has us HS last, new priority has us HS before Sepp
            else if (this.MyState.divine_might == true && !use_old_priority)
                chosen_ability = ActionRecord_GCD["HS"];
            else if (this.MyState.sword_oath == this.MyState.A3Ready)
                chosen_ability = ActionRecord_GCD["Sep"];
            else if (this.MyState.divine_might == true && use_old_priority)
                chosen_ability = ActionRecord_GCD["HS"];
            else if (this.MyState.sword_oath == 0 && this.MyState.divine_might == false)
                chosen_ability = ActionRecord_GCD["Royal"];
        }

        this.useGcd(chosen_ability);
    }

    useBurstFiller(prioritise_melee: boolean, replace_1_w_hc?: boolean) {
        let chosen_ability = ActionRecord_GCD["Fast"];

        // We always Sepulchre if we have it:
        if (this.MyState.sword_oath == this.MyState.A3Ready)
            chosen_ability = ActionRecord_GCD["Sep"];

        // prioritise_melee blocks this check:
        else if (this.MyState.divine_might == true && !prioritise_melee)
            chosen_ability = ActionRecord_GCD["HS"];
        else if (this.MyState.sword_oath == this.MyState.A1Ready)
            chosen_ability = ActionRecord_GCD["Atone"];
        else if (this.MyState.sword_oath == this.MyState.A2Ready)
            chosen_ability = ActionRecord_GCD["Supp"];
        // When we prioritise_melee, only use HS if it is our last option
        else if (this.MyState.divine_might == true)
            chosen_ability = ActionRecord_GCD["HS"];
        else if (this.MyState.sword_oath == 0 && this.MyState.divine_might == false) {
            if (this.MyState.combo_state == 3)
                chosen_ability = ActionRecord_GCD["Royal"];
            else if (this.MyState.combo_state == 2)
                chosen_ability = ActionRecord_GCD["Riot"];
            else if (replace_1_w_hc)
                chosen_ability = ActionRecord_GCD["HSHC"];
        }

        this.useGcd(chosen_ability);
    }

    useOgcdLateWeave(ability: OgcdAbility, hyperPrecise?: boolean): AbilityUseResult {
        if (hyperPrecise)
            this.advanceTo(this.nextGcdTime - (STANDARD_ANIMATION_LOCK) - this.teeny_tiny_safety_margin);
        else
            this.advanceTo(this.nextGcdTime - (STANDARD_ANIMATION_LOCK) - this.larger_safety_margin);
        return this.useOgcd(ability);
    }

    override addSpecialRow(message: string, time?: number) {
        if (!this.hideCommentText)
            super.addSpecialRow(message, time);
    }

    override useGcd(ability: GcdAbility): AbilityUseResult {
        // Automatically update our state when we use a GCD:
        this.MyState.perform_action(ability);
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
            simulateMissing9th: false,
        };
    };

    spec = pldSKSSheetSpec;
    shortName = "pld-sheet-sim";
    displayName = pldSKSSheetSpec.displayName;

    constructor(settings?: PldSKSSheetSettingsExternal) {
        super('PLD', settings);

    }


    override makeCustomConfigInterface(settings: PldSKSSheetSettings): HTMLElement {

        const outerDiv = document.createElement("div");
        const behaviorDiv = document.createElement("div");
        const openerDiv = document.createElement("div");
        const oddbinsDiv = document.createElement("div");

        const sksCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'acknowledgeSKS', {id: 'sks-checkbox'});
        const justMinimiseCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'justMinimiseDrift', {id: 'justmin-checkbox'});
        const tryCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'attempt9GCDAbove247', {id: 'try-checkbox'});
        const lateCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'alwaysLateWeave', {id: 'late-checkbox'});
        const avoidDoubleHS9sCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'avoidDoubleHS9s', {id: 'avoid2hs-checkbox'});
        const hyperRobotCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'useHyperRobotPrecision', {id: 'hyper-checkbox'});
        const neverGet9Check = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'simulateMissing9th', {id: 'neverget9-checkbox'});


        const hcOpenCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'hardcastopener', {id: 'hc-checkbox'});
        const earlyOpenCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'burstOneGCDEarlier', {id: 'early-checkbox'});
        const disableBurnCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'disableBurnDown', {id: 'burn-checkbox'});

        const disableNewPrioCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'perform12312OldPrio', {id: 'prio-checkbox'});
        const use701potenciesCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'use701potencies', {id: 'potency701-checkbox'});
        const hideCommentsCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'hideCommentText', {id: 'hidecomms-checkbox'});


        const opt1 = document.createElement("options1");
        const space1 = document.createElement("space1");
        const opt2 = document.createElement("options2");
        const space2 = document.createElement("space2");
        const opt3 = document.createElement("options3");
        const space3 = document.createElement("space3");

        behaviorDiv.appendChild(labeledCheckbox('Adjust Rotation for Skill Speed', sksCheck));
        behaviorDiv.appendChild(labelFor("Strategy Options:", opt1));
        behaviorDiv.appendChild(labeledCheckbox('Force just minimise drifting & 8s', justMinimiseCheck));
        behaviorDiv.appendChild(labeledCheckbox('Force trying for 9/8 at 2.47+', tryCheck));
        behaviorDiv.appendChild(labeledCheckbox('Force always late FOF at 2.43+', lateCheck));
        behaviorDiv.appendChild(labeledCheckbox('Avoid 2x & early HS in 9 GCD FOFs', avoidDoubleHS9sCheck));
        behaviorDiv.appendChild(labeledCheckbox('Assume perfect FOF late weaves', hyperRobotCheck));
        behaviorDiv.appendChild(labeledCheckbox('Simulate always missing 9th GCD', neverGet9Check));
        behaviorDiv.appendChild(labelFor("-", space1));

        openerDiv.appendChild(labelFor("Start & End:", opt2));
        openerDiv.appendChild(labeledCheckbox('Include a hardcast HS in the opener', hcOpenCheck));
        openerDiv.appendChild(labeledCheckbox('Use opener 1 GCD earlier', earlyOpenCheck));
        openerDiv.appendChild(labeledCheckbox('Disable 20s burn down optimisation', disableBurnCheck));
        openerDiv.appendChild(labelFor("-", space2));

        oddbinsDiv.appendChild(labelFor("Odd Options:", opt3));
        oddbinsDiv.appendChild(labeledCheckbox('What if? Use Endwalker 12312 Prio', disableNewPrioCheck));
        oddbinsDiv.appendChild(labeledCheckbox('Use Potencies from 7.01', use701potenciesCheck));
        oddbinsDiv.appendChild(labeledCheckbox('Hide All Extra Comments on Sheet', hideCommentsCheck));
        oddbinsDiv.appendChild(labelFor("-", space3));

        // Add our 3 sets of options:
        outerDiv.appendChild(behaviorDiv);
        outerDiv.appendChild(openerDiv);
        outerDiv.appendChild(oddbinsDiv);

        return outerDiv;
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
                ActionRecord_GCD["Fast"] = Actions.FastBlade;
                ActionRecord_GCD["Riot"] = Actions.RiotBlade;
                ActionRecord_GCD["Royal"] = Actions.RoyalAuthority;
                ActionRecord_GCD["HS"] = Actions.HolySpirit;
                ActionRecord_GCD["HSHC"] = Actions.HolySpiritHardcast;
                ActionRecord_GCD["Atone"] = Actions.Atonement;
                ActionRecord_GCD["Supp"] = Actions.Supplication;
                ActionRecord_GCD["Sep"] = Actions.Sepulchre;
                ActionRecord_GCD["Gore"] = Actions.GoringBlade;
                ActionRecord_GCD["Conf"] = Actions.Confiteor;
                ActionRecord_GCD["Faith"] = Actions.BladeOfFaith;
                ActionRecord_GCD["Truth"] = Actions.BladeOfTruth;
                ActionRecord_GCD["Valor"] = Actions.BladeOfValor;

                // Alter based on setting:
                if (sim.settings.use701potencies) {
                    // Filler potency changes:
                    ActionRecord_GCD["Royal"] = cp.CopyGCDAction(Actions.RoyalAuthority, 440);
                    ActionRecord_GCD["HS"] = cp.CopyGCDAction(Actions.HolySpirit, 470);
                    ActionRecord_GCD["HSHC"] = cp.CopyGCDAction(Actions.HolySpiritHardcast, 370);
                    ActionRecord_GCD["Atone"] = cp.CopyGCDAction(Actions.Atonement, 440);
                    ActionRecord_GCD["Supp"] = cp.CopyGCDAction(Actions.Supplication, 460);
                    ActionRecord_GCD["Sep"] = cp.CopyGCDAction(Actions.Sepulchre, 480);

                    // Burst potency changes:
                    ActionRecord_GCD["Conf"] = cp.CopyGCDAction(Actions.Confiteor, 940);
                    ActionRecord_GCD["Faith"] = cp.CopyGCDAction(Actions.BladeOfFaith, 740);
                    ActionRecord_GCD["Truth"] = cp.CopyGCDAction(Actions.BladeOfTruth, 840);
                    ActionRecord_GCD["Valor"] = cp.CopyGCDAction(Actions.BladeOfValor, 940);
                }

                let strategy_250 = false;
                let strategy_98_alt = false;
                let strategy_98_force = false;
                let strategy_always9 = false;
                let strategy_minimise = false;
                let strategy_special250late = true;
                const strategy_hubris = (sim.settings.acknowledgeSKS == false);

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
                if (physGCD > 2.49 && !strategy_hubris) {
                    if (sim.settings.alwaysLateWeave) {
                        cp.addSpecialRow(`Late Weaving FOF at 2.50, OK! (Override)`);
                        strategy_always9 = true;
                        strategy_special250late = false;
                    }
                    else {
                        cp.addSpecialRow(`No SKS to consider due to 2.5 GCD`);
                        strategy_250 = true;
                    }
                }
                else if (strategy_hubris) {
                    cp.addSpecialRow(``);
                    cp.addSpecialRow(`SKS Rotations are disabled.`);
                    cp.addSpecialRow(`Sim will DELIBERATELY CLIP GCD`);
                    cp.addSpecialRow(`due intentionally playing as though 2.5`);
                    cp.addSpecialRow(``);
                    cp.addSpecialRow(`Gives a baseline for when no sks opti`);
                    cp.addSpecialRow(`is performed for given Total Time.`);
                    cp.addSpecialRow(``);
                    strategy_250 = true;
                }
                    // We then have a variety of things to consider.
                    // at 2.47 and above, PLD is unlikely to achieve a 9 GCD FOF
                // So we don't try, and instead aim to minimise buff drift
                else if (physGCD > 2.46 || sim.settings.justMinimiseDrift) {
                    if (sim.settings.justMinimiseDrift) {
                        cp.addSpecialRow(`Just minimising drift, use FOF on CD always`);
                        strategy_minimise = true;
                    }
                    // However we have setting over rides to force our hand:
                    else if (sim.settings.alwaysLateWeave == true) {
                        cp.addSpecialRow(`Late FOF w/2.43+ GCD (Override)`);
                        cp.addSpecialRow(`(+personal pps, --alignment & big drift)`);
                        strategy_always9 = true;
                    }
                    else if (sim.settings.attempt9GCDAbove247 == true) {
                        cp.addSpecialRow(`9/8 FOF w/2.47+ GCD (Override)`);
                        strategy_98_alt = true;
                    }
                    else {
                        cp.addSpecialRow(`2.47+ GCD, aim to minimise drift`);
                        strategy_minimise = true;
                    }
                }
                    // At 2.43 to 2.46, it should be possible to alternate a 9 GCD and an 8 GCD
                    // FOF to minimise drift, and just get a little extra from party buffs
                // It's so, so little though, lol.
                else if (physGCD > 2.42) {
                    // 2.43 specifically is cursed:
                    if (physGCD < 2.44) {
                        cp.addSpecialRow(`2.43 Phys GCD is particularly challenging.`);
                        cp.addSpecialRow(`It either delays fof significantly`);
                        cp.addSpecialRow(`or risks clipping it's GCD to do 9/8`);

                        if (sim.settings.alwaysLateWeave) {
                            strategy_always9 = true;
                            cp.addSpecialRow(`Late FOF w/2.43 GCD (Override)`);
                            cp.addSpecialRow(`(+personal pps, -buff alignment`);
                        }
                        else {
                            strategy_98_alt = true;
                            strategy_98_force = true;
                            cp.addSpecialRow(`Presenting CLIP strat (+buff alignment, -potency)`);
                            cp.addSpecialRow(`(consider the 'always late' sim option)`);
                        }
                    }
                    else {
                        // If we're 2.44 - 2.46
                        if (sim.settings.alwaysLateWeave == true) {
                            cp.addSpecialRow(`Late FOF w/2.43+ GCD (Override)`);
                            cp.addSpecialRow(`(+personal pps, -buff alignment)`);
                            strategy_always9 = true;
                        }
                        else {
                            cp.addSpecialRow(`2.44-2.46 GCD, alternating 9/8 FOFs`);
                            cp.addSpecialRow(`(+buff alignment, low drift)`);
                            strategy_98_alt = true;
                        }
                    }
                }
                // Otherwise, if our GCD is 2.37 - 2.42 We will always late weave FOF:
                else if (physGCD > 2.36) {
                    cp.addSpecialRow(`Always Late FOF at 2.37+ GCD`);
                    strategy_always9 = true;
                }
                // Below that, things get weird, so let's just rely on the sim's override options:
                else {
                    cp.addSpecialRow(`Phys GCD very low! Use Overrides to trial behavior:`);
                    if (sim.settings.alwaysLateWeave == true) {
                        cp.addSpecialRow(`Always late override, Late FOFs`);
                        strategy_always9 = true;
                    }
                    else if (sim.settings.attempt9GCDAbove247 == true) {
                        cp.addSpecialRow(`9/8 Override, will late weave evens`);
                        strategy_98_alt = true;
                    }
                    else {
                        cp.addSpecialRow(`No Overrides, Minimizing Drift`);
                        strategy_minimise = true;
                    }
                }

                if (!strategy_250 && physGCD != 2.50) {
                    cp.addSpecialRow("");
                    cp.addSpecialRow("This strategy will delay FOF in some way");
                    cp.addSpecialRow("Big delays = misalign from party buffs");
                    cp.addSpecialRow("Big delays = potential lost usage");
                    cp.addSpecialRow("Check bottom of chart for delay summary!");
                    cp.addSpecialRow("Add appropriate party buffs in settings.");
                    cp.addSpecialRow("");
                    if (strategy_always9 || strategy_98_alt) {
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
                    }
                    else {
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

                if (strategy_always9 && strategy_special250late) {
                    cp.addSpecialRow(`>> Always 9 GCD FOF: Hold Atonement`);
                }
                // We will not set our loop up to attempt a special first burst
                // and juse use things as early as possible after the '3rd' GCD


                // Standard opener:
                if (sim.settings.hardcastopener)
                    cp.useGcd(ActionRecord_GCD["HSHC"]);
                cp.useGcd(ActionRecord_GCD["Fast"]);
                cp.useGcd(ActionRecord_GCD["Riot"]);
                if (!sim.settings.burstOneGCDEarlier) {
                    cp.useGcd(ActionRecord_GCD["Royal"]);
                }
                else {
                    cp.addSpecialRow(">> Override: Bursting 1 GCD earlier")
                }

                let safety = 0;
                let even_minute = true;
                let force_next_burst = false;

                let only_cos_once_in_filler = true;
                let only_exp_once_in_filler = true;

                // Number cruncing stuff:
                let fofs_used = 0;
                let time_of_first_fof = 0;
                let time_of_last_fof = 0;
                let end_of_time_burn = false;
                let fof_delay_tracker_next = 0;

                let clip_total_time = 0;

                while ((cp.remainingGcdTime > 0) && (safety < 100000)) {
                    // While loops with no safety clause!
                    safety++;

                    if (strategy_minimise || strategy_98_alt || strategy_hubris) {
                        // if we are forcing 9/8s, we can't rely on canUseWithoutClipping
                        // this is because: we will clip, lol.
                        // We also want to provide feedback on if we delayed FOF across a GCD

                        const readyAt = fof_delay_tracker_next;
                        const next_early = cp.nextGcdTime + STANDARD_ANIMATION_LOCK;
                        // note that this is the going to delay up to the earliest weave after the next GCD:
                        if (readyAt > cp.currentTime && readyAt < (next_early)) {
                            // If this is going to collide with the next GCD, we want to know about it

                            // If we are forcing 98s and this is an even minute, we will get our awareness
                            // elsewhere:
                            if ((strategy_98_force && even_minute))
                                force_next_burst = true;
                            else {
                                const is_after_late_weave_limit = (readyAt > (cp.nextGcdTime - STANDARD_ANIMATION_LOCK));
                                const is_after_next_gcd = readyAt > cp.nextGcdTime;
                                // Otherwise, add to the log what we are doing:
                                if (is_after_late_weave_limit) {
                                    if (strategy_hubris) {
                                        cp.addSpecialRow(">> FOF comes up in " + (readyAt - cp.currentTime).toFixed(2) + "s");
                                        if (is_after_next_gcd) {
                                            cp.addSpecialRow(">> This is after the next GCD.");
                                            cp.addSpecialRow(">> A non-sks inclined player likely uses the GCD");
                                            cp.addSpecialRow(">> Delaying FOF by " + (next_early - readyAt).toFixed(2) + "s");
                                        }
                                        else {
                                            cp.addSpecialRow(">> Clipping once available!");
                                            cp.advanceTo(readyAt);
                                            force_next_burst = true;
                                        }
                                    }
                                    else
                                        cp.addSpecialRow(">> Delaying FOF " + (next_early - readyAt).toFixed(2) + "s across GCD...", readyAt);
                                }
                            }
                        }


                    }

                    if (cp.canUseWithoutClipping(ActionRecord_oGCD["FOF"]) || force_next_burst) {

                        if (strategy_250 || strategy_minimise) {
                            if (strategy_minimise)
                                cp.addSpecialRow(`>> Using FOF ASAP`);
                            cp.useOgcd(ActionRecord_oGCD["FOF"]);
                        }
                        else {
                            // Should we try to late weave?
                            // DANGER DANGER: Magic number:
                            //let fof_is_not_early = cp.cdTracker.statusOf(ActionRecord_oGCD["FOF"]).readyAt.relative > 1.0;

                            // if we are on an even minute, and we're 98ing
                            if ((strategy_98_alt && even_minute) || strategy_always9) {
                                const readyAt = fof_delay_tracker_next;
                                cp.addSpecialRow(`>> FOF Ready, Late Weaving FOF!`, readyAt);
                                // if force is on, we are here because we are clipping our GCD:
                                if (strategy_98_force) {
                                    if (!cp.canUseWithoutClipping(ActionRecord_oGCD["FOF"])) {
                                        const beforeGCD = cp.nextGcdTime;
                                        cp.delayForOgcd(ActionRecord_oGCD["FOF"]);
                                        const clip_amount = cp.nextGcdTime - beforeGCD;
                                        cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clip_amount).toFixed(2) + "s");
                                        clip_total_time += clip_amount;
                                    }
                                    else {
                                        cp.useOgcdLateWeave(ActionRecord_oGCD["FOF"], sim.settings.useHyperRobotPrecision);
                                    }

                                }
                                else {
                                    // a normal late weave is fine:
                                    cp.useOgcdLateWeave(ActionRecord_oGCD["FOF"], sim.settings.useHyperRobotPrecision);
                                }
                                if (fofs_used != 0) {
                                    const fofUsedTime = cp.currentTime - STANDARD_ANIMATION_LOCK;
                                    const delayedBy = fofUsedTime - readyAt;

                                    cp.addSpecialRow(`>> Delay to FOF: ` + (delayedBy).toFixed(2) + `s`, fofUsedTime);
                                }
                            }
                            else {
                                cp.addSpecialRow(`Using FOF ASAP`);
                                cp.useOgcd(ActionRecord_oGCD["FOF"]);
                            }
                        }

                        fof_delay_tracker_next = cp.cdTracker.statusOf(ActionRecord_oGCD["FOF"]).readyAt.absolute;

                        if (fofs_used == 0)
                            time_of_first_fof = cp.currentTime;
                        fofs_used++;
                        time_of_last_fof = cp.currentTime;


                        let oGCDcounter = 0;

                        // TODO: Intervene will be available earlier than other other oGCDs after a certain point:
                        const ogcdOrder = [ActionRecord_oGCD["Imp"], ActionRecord_oGCD["Cos"], ActionRecord_oGCD["Exp"],
                                           ActionRecord_oGCD["Int"], ActionRecord_oGCD["Int"]];

                        /////////////////
                        // We have now entered burst: perform all burst actions:

                        // Sks Pattern Detection:
                        if (strategy_250 || strategy_hubris || cp.canUseWithoutClipping(ActionRecord_oGCD["Imp"])) {
                            // In this case, we definitely haven't late weaved
                            // Set counter to 1, as we will have already used our burst first oGCD
                            oGCDcounter = 1;

                            if (strategy_hubris) {
                                let is_gonna_clip = false;
                                const beforeGCD = cp.nextGcdTime;
                                // If we're specifically pretending SKS doesn't exist, delay for Req+
                                if (!cp.canUseWithoutClipping(ActionRecord_oGCD["Imp"]))
                                    is_gonna_clip = true;

                                cp.delayForOgcd(ActionRecord_oGCD["Imp"]);

                                if (is_gonna_clip) {
                                    const clip_amount = cp.nextGcdTime - beforeGCD;
                                    cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clip_amount).toFixed(2) + "s");
                                    clip_total_time += clip_amount;
                                }

                            }
                            else {
                                cp.useOgcd(ActionRecord_oGCD["Imp"]);
                            }
                        }
                        else {
                            // we could not use imperator before, so we must melee first GCD
                            // The easiest way to check this is simply, is oGCDcounter 1 or not?
                        }

                        // In this situation, we have given ourselves the req buff in the same
                        // weave window as FOF.
                        // This seems like a weird way to discern this but it makes it easier
                        // to steer the strategy_minimise pathway down here:

                        if (oGCDcounter == 1) {
                            // This burst is suggested to start blades early, to help avoid
                            // a situation where we lose BladeOfHonor due to phasing/death etc
                            cp.useGcd(ActionRecord_GCD["Conf"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Faith"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Truth"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Valor"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useOgcd(ActionRecord_oGCD["Honor"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Gore"]);
                        }
                            // In this situation, we have not yet been able to give ourselves
                        // req stacks. We *may* have late weaved FOF:
                        else {
                            cp.useGcd(ActionRecord_GCD["Gore"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Conf"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Faith"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Truth"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(ActionRecord_GCD["Valor"]);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useOgcd(ActionRecord_oGCD["Honor"]);
                        }

                        // How much longer is actually left on FOF?

                        // Use any further ogcds, and burn down to when we only have time for
                        // 1 more GCD
                        let prioritise_melee = true;
                        if (strategy_always9 || (strategy_98_alt && even_minute))
                            prioritise_melee = true;

                        oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);

                        let enough_time_if_melee = cp.fofIsActive((cp.nextGcdTime + physGCD));
                        let fof_remaining = cp.getFOFRemaining().toFixed(2);

                        let burstGCDsUsed = 0;

                        while (enough_time_if_melee && safety < 100000) {
                            safety++;
                            // Note the current status:
                            if (!strategy_250)
                                cp.addSpecialRow(`>> FOF: ${fof_remaining}s, phys prio`);
                            // Use a burst GCD
                            cp.useBurstFiller(prioritise_melee && (!sim.settings.perform12312OldPrio));
                            // Use any remaining oGCDs:
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            // Count how many GCDs we have now used:
                            burstGCDsUsed++;

                            // Update our variables:
                            enough_time_if_melee = cp.fofIsActive((cp.nextGcdTime + physGCD));
                            fof_remaining = cp.getFOFRemaining().toFixed(3);

                            if (strategy_minimise && burstGCDsUsed == 2) {
                                enough_time_if_melee = false;
                            }

                            // Fix 'time runs out in middle of burst' infinite loop:
                            if (cp.remainingGcdTime == 0)
                                enough_time_if_melee = false;
                        }

                        if (!strategy_250)
                            cp.addSpecialRow(`>> Final burst GCD margin: ${fof_remaining}s:`);
                        else
                            cp.addSpecialRow(`>> Final burst GCD:`);

                        if (sim.settings.simulateMissing9th && burstGCDsUsed == 3) {
                            cp.advanceTo(cp.nextGcdTime);
                            cp.addSpecialRow(`>> (option) Simming this GCD misses FOF:`);
                            cp.removeBuff(Buffs.FightOrFlightBuff);
                        }
                        cp.useBurstFiller(false);

                        only_cos_once_in_filler = true;
                        only_exp_once_in_filler = true;

                        // Our buffs have expired, burst is complete:
                        // Flip even minute state:
                        even_minute = !even_minute;
                        force_next_burst = false;

                        if (strategy_98_alt) {
                            if (even_minute)
                                cp.addSpecialRow(`>> 9/8 Even min: Hold Atonement`);
                            else
                                cp.addSpecialRow(`>> 9/8 Odd min: Spend Atonement`);
                        }
                    }

                    // If there are fewer than 20 seconds remaining in the user selected
                    // time window:
                    if (cp.remainingTime < 20 && !end_of_time_burn && !sim.settings.disableBurnDown) {
                        cp.addSpecialRow("Less than 20s remain on sim!");
                        cp.addSpecialRow("Will now burn GCD resources.");
                        cp.addSpecialRow("Replace new combo w/HS in last 3 GCDs");
                        end_of_time_burn = true;
                    }

                    // This is the bit where we just use filler:
                    if (end_of_time_burn) {
                        // we also replace 1s with hardcasts under 3 phys GCDs, preventing a new combo starting
                        cp.useBurstFiller(false, cp.remainingGcdTime < (physGCD * 3));
                    }
                    else
                        cp.useFiller((even_minute && strategy_98_alt) || (strategy_always9 && strategy_special250late),
                            sim.settings.perform12312OldPrio, sim.settings.avoidDoubleHS9s);

                    // There are some circumstances where eg 2.47 will have these come off of
                    // cd when messing with FOF. Let's only use them once between bursts.
                    // Also: technically someone playing with hubris would clip these, too:
                    if (cp.canUseWithoutClipping(ActionRecord_oGCD["Cos"]) && only_cos_once_in_filler) {
                        cp.useOgcd(ActionRecord_oGCD["Cos"]);
                        only_cos_once_in_filler = false;
                        if (strategy_hubris) {
                            const beforeGCD = cp.nextGcdTime;
                            cp.delayForOgcd(ActionRecord_oGCD["Exp"]);
                            if ((cp.nextGcdTime - beforeGCD) > 0) {
                                const clip_amount = cp.nextGcdTime - beforeGCD;
                                cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clip_amount).toFixed(2) + "s");
                                clip_total_time += clip_amount;
                            }
                            only_exp_once_in_filler = false;
                        }
                    }
                    if (cp.canUseWithoutClipping(ActionRecord_oGCD["Exp"]) && only_exp_once_in_filler) {
                        cp.useOgcd(ActionRecord_oGCD["Exp"]);
                        only_exp_once_in_filler = false;
                    }
                }

                const fof_delta = (time_of_last_fof - time_of_first_fof) - ((fofs_used - 1) * 60);
                const avg_delay_fof = fof_delta / (fofs_used - 1);

                cp.addSpecialRow(">> Summaries:");

                cp.addSpecialRow("Number of FOFs: " + fofs_used.toFixed(0));
                cp.addSpecialRow("Net FOF delay by end: " + fof_delta.toFixed(2));
                cp.addSpecialRow("Average delay: " + avg_delay_fof.toFixed(2));
                if (avg_delay_fof > 0.01) {
                    const three_gcd_delay = 7.5 / avg_delay_fof;
                    cp.addSpecialRow("Burst hits 7.5s delay @ ~" + three_gcd_delay.toFixed(0) + "m");
                    cp.addSpecialRow("Delay interacts with Party Buffs.");
                }
                if (clip_total_time > 0.01) {
                    cp.addSpecialRow("! ALERT !: Total clip time: " + clip_total_time.toFixed(2) + "s");
                    cp.addSpecialRow("Avg of " + ((clip_total_time / cp.currentTime) * 60).toFixed(2) + "s Clip every min");
                }
            }

        }]
    }

}