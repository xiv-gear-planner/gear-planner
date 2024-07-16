import {GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, 
        AbilityUseResult, Rotation} from "@xivgear/core/sims/cycle_sim";
import {STANDARD_ANIMATION_LOCK} from "@xivgear/xivmath/xivconstants";
import {BaseMultiCycleSim} from "../../sim_processors";
import * as Actions from './pld_actions';
import * as Buffs from './pld_buffs';
import {
    FieldBoundCheckBox,
    labeledCheckbox
} from "@xivgear/common-ui/components/util";



class PaladinStateSystem {
    // This simple class accepts the GCD that we performed
    // and updates the state of our filler
    A1Ready: number = 0b0001;
    A2Ready: number = 0b0010;
    A3Ready: number = 0b0100;

    combo_state: number = 1;
    sword_oath: number = 0;
    divine_might: boolean = false;

    perform_action(GCDused: GcdAbility)
    {
        if (GCDused == Actions.FastBlade)
        {
            this.combo_state = 2;
        }
        else if (GCDused == Actions.RiotBlade)
        {
            if (this.combo_state == 2)
                this.combo_state = 3;
            else
                this.combo_state = 0;
        }
        else if (GCDused == Actions.RoyalAuthority)
        {
            if (this.combo_state == 3)
            {
                this.combo_state = 1;
                this.divine_might = true;
                this.sword_oath = this.sword_oath | this.A1Ready
            }
            else
                this.combo_state = 0;
        }
        else if (GCDused == Actions.HolySpirit)
        {
            // Consume Divine Might:
            this.divine_might = false;
        }
        else if (GCDused == Actions.Atonement)
        {
            if (this.sword_oath & this.A1Ready)
            {
                // Remove AtonementReady, Add Supplication Ready
                this.sword_oath = (this.sword_oath & ~this.A1Ready) | this.A2Ready;
            }
        }
        else if (GCDused == Actions.Supplication)
        {
            if (this.sword_oath & this.A2Ready)
            {
                // Remove Supplication Ready, Add Sepulchre Ready
                this.sword_oath = (this.sword_oath & ~this.A2Ready) | this.A3Ready;
            }
        }
        else if (GCDused == Actions.Sepulchre)
        {
            if (this.sword_oath & this.A3Ready)
            {
                // Remove Sepulchre
                this.sword_oath = (this.sword_oath & (~this.A3Ready));
            }
        }
    }

    
    debugState() {
        console.log( [ this.combo_state , this.sword_oath , this.divine_might ].toString() );
    }
}

export interface PldSKSSheetSimResult extends CycleSimResult {
}

export interface PldSKSSheetSettings extends SimSettings {
    acknowledgeSKS: boolean,
    attempt9GCDAbove247: boolean,
    alwaysLateWeave: boolean,
    hardcastopener: boolean,
    burstOneGCDEarlier: boolean,
    disableBurnDown: boolean,
    perform12312OldPrio: boolean,
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
    description: "Paladin w/SKS Strategy Simulator:\n" + 
    "While a ~max ilvl 2.50 set will always be best, sometimes: you just end up with Skill Speed.\n\n" +
    "This sim can demonstrate the efficacy of certain rotation strategies you could adopt " + 
    "for a given GCD. It includes many notes on the simulation chart.\n\n" +
    "NB: Don't compare different GCD speeds directly: they will end phases on weaker/stronger GCDs " +
    "compared to one another, which influences the results.", 
    isDefaultSim: false
};

class PldSKSCycleProcessor extends CycleProcessor {
    MyState: PaladinStateSystem;
    MySettings: PldSKSSheetSettings;

    teeny_tiny_safety_margin: number = 0.001
    // stats: ComputedSetStats;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        // More settings interpretation stuff goes here
        this.MyState = new PaladinStateSystem();
        // this.stats = settings.stats;
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
            if (this.canUseWithoutClipping(order[idx]))
            {
                this.useOgcd(order[idx]);
                idx++;
            }
        }
        if (idx < order.length) {
            if (this.canUseWithoutClipping(order[idx]))
            {
                this.useOgcd(order[idx]);
                idx++;
            }
        }
        return idx;
    }

    useFiller(even_minute: boolean, use_old_priority?: boolean) {
        // During regular filler, we will always use a specific GCD based on our state
        let chosen_ability = Actions.FastBlade;

        // if we are atonement ready, become supplication ready:
        // This top If statement is what optimises us for 3 GCDs in FOF
        // When we have SKS and expect a 9 GCD FOF, we will skip this aspect
        // The parameter, even_minute, will be true when we are approaching an even minute burst

        if (this.MyState.sword_oath == this.MyState.A1Ready && even_minute == false && !use_old_priority)
        {
            chosen_ability = Actions.Atonement;
        }
        else if (this.MyState.combo_state != 3)
        {
            if (this.MyState.combo_state == 2)
                chosen_ability = Actions.RiotBlade;
            else
                chosen_ability = Actions.FastBlade;
        }
        else
        {
            // If we are royal ready:
            if (this.MyState.sword_oath == this.MyState.A1Ready)
                chosen_ability = Actions.Atonement;
            else if (this.MyState.sword_oath == this.MyState.A2Ready)
                chosen_ability = Actions.Supplication;
            else if (this.MyState.divine_might == true && !use_old_priority)
                chosen_ability = Actions.HolySpirit;
            else if (this.MyState.sword_oath == this.MyState.A3Ready)
                chosen_ability = Actions.Sepulchre;
            else if (this.MyState.divine_might == true && use_old_priority)
                chosen_ability = Actions.HolySpirit;
            else if (this.MyState.sword_oath == 0 && this.MyState.divine_might == false)
                chosen_ability = Actions.RoyalAuthority;
        }

        this.useGcd(chosen_ability);
    }

    useBurstFiller(prioritise_melee: boolean, replace_1_w_hc?: boolean) {
        let chosen_ability = Actions.FastBlade;

        // We always Sepulchre if we have it:
        if (this.MyState.sword_oath == this.MyState.A3Ready)
            chosen_ability = Actions.Sepulchre;

        // prioritise_melee blocks this check:
        else if (this.MyState.divine_might == true && !prioritise_melee)
            chosen_ability = Actions.HolySpirit;
        else if (this.MyState.sword_oath == this.MyState.A1Ready)
            chosen_ability = Actions.Atonement;
        else if (this.MyState.sword_oath == this.MyState.A2Ready)
            chosen_ability = Actions.Supplication;
        // When we prioritise_melee, only use HS if it is our last option
        else if (this.MyState.divine_might == true)
            chosen_ability = Actions.HolySpirit;
        else if (this.MyState.sword_oath == 0 && this.MyState.divine_might == false)
        {
            if (this.MyState.combo_state == 3)
                chosen_ability = Actions.RoyalAuthority;
            else if (this.MyState.combo_state == 2)
                chosen_ability = Actions.RiotBlade;
            else if (replace_1_w_hc)
                chosen_ability = Actions.HolySpiritHardcast;
        }

        this.useGcd(chosen_ability);
    }

    useOgcdLateWeave(ability: OgcdAbility): AbilityUseResult {
        this.advanceTo(this.nextGcdTime - (STANDARD_ANIMATION_LOCK) - this.teeny_tiny_safety_margin);
        return this.useOgcd(ability);
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

    delayForOgcd(ability: OgcdAbility) : AbilityUseResult {
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
            attempt9GCDAbove247: false,
            alwaysLateWeave: false,
            hardcastopener: true,
            burstOneGCDEarlier: false,
            disableBurnDown: false,
            perform12312OldPrio: false,
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
        const checkboxesDiv = document.createElement("div");

        const sksCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'acknowledgeSKS', {id: 'sks-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('Acknowledge Skill Speed', sksCheck));
        const tryCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'attempt9GCDAbove247', {id: 'try-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('Force trying for 9/8 at 2.47+', tryCheck));
        const lateCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'alwaysLateWeave', {id: 'late-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('Force always Late FOF at 2.43+', lateCheck));
        const hcOpenCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'hardcastopener', {id: 'hc-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('Include a hardcast HS in the opener', hcOpenCheck));
        const earlyOpenCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'burstOneGCDEarlier', {id: 'early-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('Use Opener 1 GCD earlier', earlyOpenCheck));
        const disableBurnCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'disableBurnDown', {id: 'burn-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('Disable 20s burn down optimisation', disableBurnCheck));
        const disableNewPrio = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'perform12312OldPrio', {id: 'prio-checkbox'});
        checkboxesDiv.appendChild(labeledCheckbox('What if? Use Endwalker 12312 Prio', disableNewPrio));

        outerDiv.appendChild(checkboxesDiv);

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

                let strategy_250 = false;
                let strategy_98_alt = false;
                let strategy_98_force = false;
                let strategy_always9 = false;
                let strategy_minimise = false;
                const strategy_hubris = (sim.settings.acknowledgeSKS == false);

                // Let's assume that we are going to do a fixed time window
                // optimisation, so, let's have an actual opener

                // A fixed time window is favourable to the perception of SKS
                // as even minimal delays to burst on an *infinite* dummy translate
                // to DPS losses that kinda do not exist in situations where you never
                // actually lose a usage: over *infinte* time, even a 0.1s delay
                // means you *eventually* lose a usage.

                cp.addSpecialRow(`Phys GCD is: ${physGCD}`);
                cp.addSpecialRow(`Magic GCD is: ${magicGCD}`);

                // However, if we are going to pretend SKS does not exist
                // (or, SKS does in fact not exist), we don't need this:
                if (physGCD > 2.49)
                {
                    cp.addSpecialRow(`No SKS to consider due to 2.5 GCD`);
                    strategy_250 = true;
                }
                else if (strategy_hubris)
                {
                    cp.addSpecialRow(``);
                    cp.addSpecialRow(`SKS Acknowledgement is disabled.`);
                    cp.addSpecialRow(`Sim will DELIBERATELY CLIP GCD`);
                    cp.addSpecialRow(`due intentionally playing as though 2.5`);
                    cp.addSpecialRow(``);
                    cp.addSpecialRow(`Gives a baseline for when no sks opti`);
                    cp.addSpecialRow(`is performed.`);
                    cp.addSpecialRow(``);
                    strategy_250 = true;
                }
                // We then have a variety of things to consider.
                // at 2.47 and above, PLD is unlikely to achieve a 9 GCD FOF
                // So we don't try, and instead aim to minimise buff drift
                else if (physGCD > 2.46) 
                {
                    // However we have setting over rides to force our hand:
                    if (sim.settings.alwaysLateWeave == true)
                    {
                        cp.addSpecialRow(`Late FOF w/2.43+ GCD (Override)`);
                        strategy_always9 = true;
                    }
                    else if (sim.settings.attempt9GCDAbove247 == true)
                    {
                        cp.addSpecialRow(`9/8 FOF w/2.47+ GCD (Override)`);
                        strategy_98_alt = true;
                    }
                    else
                    {
                        cp.addSpecialRow(`2.47+ GCD, aim to minimise drift`);
                        strategy_minimise = true;
                    }
                }
                // At 2.43 to 2.46, it should be possible to alternate a 9 GCD and an 8 GCD
                // FOF to minimise drift, and just get a little extra from party buffs
                // It's so, so little though, lol.
                else if (physGCD > 2.42)
                {
                    // 2.43 specifically is cursed:
                    if (physGCD < 2.44)
                    {
                        cp.addSpecialRow(`2.43 Phys GCD is particularly challenging.`);
                        cp.addSpecialRow(`It either delays fof significantly`);
                        cp.addSpecialRow(`or risks clipping it's GCD to do 9/8`);

                        if (sim.settings.alwaysLateWeave)
                        {
                            strategy_always9 = true;
                            cp.addSpecialRow(`Late FOF w/2.43 GCD (Override)`);
                        }
                        else
                        {
                            strategy_98_alt = true;
                            strategy_98_force = true;
                            cp.addSpecialRow(`Presenting CLIP GCD strat`);
                            cp.addSpecialRow(`(consider always late weave option)`);
                        }
                    }
                    else
                    {
                        // If we're 2.44 - 2.46
                        if (sim.settings.alwaysLateWeave == true)
                        {
                            cp.addSpecialRow(`Late FOF w/2.43+ GCD (Override)`);
                            strategy_always9 = true;
                        }
                        else
                        {
                            cp.addSpecialRow(`2.44-2.46 GCD, alternating 9/8 FOFs`);
                            strategy_98_alt = true;
                        }
                    }
                }
                // Otherwise, if our GCD is 2.37 - 2.42 We will always late weave FOF:
                else if (physGCD > 2.36)
                {
                    cp.addSpecialRow(`Always Late FOF at 2.37+ GCD`);
                    strategy_always9 = true;
                }
                // Below that, things get weird, so let's just rely on the sim's override options:
                else
                {
                    cp.addSpecialRow(`Phys GCD very low! Use Overrides to trial behavior:`);
                    if (sim.settings.alwaysLateWeave == true)
                    {
                        cp.addSpecialRow(`Always late override, Late FOFs`);
                        strategy_always9 = true;
                    }
                    else if (sim.settings.attempt9GCDAbove247 == true)
                    {
                        cp.addSpecialRow(`9/8 Override, will late weave evens`);
                        strategy_98_alt = true;
                    }
                    else
                    {
                        cp.addSpecialRow(`No Overrides, Minimizing Drift`);
                        strategy_minimise = true;
                    }
                }

                if (sim.settings.perform12312OldPrio)
                {
                    cp.addSpecialRow("");
                    cp.addSpecialRow("The Use Endwalker Prio setting is ON");
                }


                if (!strategy_250)
                {
                    cp.addSpecialRow("");
                    cp.addSpecialRow("This strategy will delay FOF in some way");
                    cp.addSpecialRow("Big delays = misalign from party buffs");
                    cp.addSpecialRow("Big delays = potential lost usage");
                    cp.addSpecialRow("Check bottom of chart for delay summary!");
                    cp.addSpecialRow("Add appropriate party buffs in settings.");
                    cp.addSpecialRow("");
                    if (strategy_always9 || strategy_98_alt)
                    {
                        cp.addSpecialRow("The Final Burst GCD of FOF may not fit");
                        cp.addSpecialRow("depending on ping & fps");
                        cp.addSpecialRow("");
                    }
                }

                if (strategy_always9)
                {
                    cp.addSpecialRow(`>> Always 9 GCD FOF: Hold Atonement`);
                }
                // We will not set our loop up to attempt a special first burst
                // and juse use things as early as possible after the '3rd' GCD

                // Standard opener:
                if (sim.settings.hardcastopener)
                    cp.useGcd(Actions.HolySpiritHardcast);
                cp.useGcd(Actions.FastBlade);
                cp.useGcd(Actions.RiotBlade);
                if (!sim.settings.burstOneGCDEarlier)
                {
                    cp.useGcd(Actions.RoyalAuthority);
                }
                else
                {
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

                let clip_total_time = 0;

                while ((cp.remainingGcdTime > 0) && (safety < 100000) ) {
                    // While loops with no safety clause!
                    safety++;

                    //console.log( [ cp.nextGcdTime - cp.currentTime , cp.cdTracker.statusOf(Actions.FightOrFlight).readyAt.relative , cp.canUseWithoutClipping(Actions.FightOrFlight) ].toString() );

                    if (strategy_minimise || strategy_98_alt || strategy_hubris)
                    {
                        // if we are forcing 9/8s, we can't rely on canUseWithoutClipping
                        // this is because: we will clip, lol.
                        // We also want to provide feedback on if we delayed FOF across a GCD
                        
                        const readyAt = cp.cdTracker.statusOf(Actions.FightOrFlight).readyAt.absolute;
                        const next_early = cp.nextGcdTime + STANDARD_ANIMATION_LOCK;
                        // note that this is the going to delay up to the earliest weave after the next GCD:
                        if (readyAt > cp.currentTime && readyAt < ( next_early ))
                        {
                            // If this is going to collide with the next GCD, we want to know about it

                            // If we are forcing 98s and this is an even minute, we will get our awareness
                            // elsewhere:
                            if ((strategy_98_force && even_minute))
                                force_next_burst = true;
                            else
                            {
                                const is_after_late_weave_limit = (readyAt > (cp.nextGcdTime - STANDARD_ANIMATION_LOCK));
                                const is_after_next_gcd = readyAt > cp.nextGcdTime;
                                // Otherwise, add to the log what we are doing:
                                if (is_after_late_weave_limit)
                                {
                                    if (strategy_hubris)
                                    {
                                        cp.addSpecialRow(">> FOF comes up in " + (readyAt - cp.currentTime).toFixed(2) + "s");
                                        if (is_after_next_gcd)
                                        {
                                            cp.addSpecialRow(">> This is after the next GCD.");
                                            cp.addSpecialRow(">> A non-sks inclined player likely uses the GCD");
                                            cp.addSpecialRow(">> Delaying FOF by " + (next_early - readyAt).toFixed(2) + "s");
                                        }
                                        else
                                        {
                                            cp.addSpecialRow(">> Delaying until available!");
                                            cp.advanceTo(readyAt);
                                            force_next_burst = true;
                                        }
                                    }
                                    else
                                        cp.addSpecialRow(">> Delaying FOF " + (next_early - readyAt).toFixed(2) +  "s across GCD...");
                                }
                            }
                        }
                    }

                    if (cp.canUseWithoutClipping(Actions.FightOrFlight) || force_next_burst)
                    {

                        if (strategy_250 || strategy_minimise)
                        {
                            if (strategy_minimise)
                                cp.addSpecialRow(`>> Using FOF ASAP`);
                            cp.useOgcd(Actions.FightOrFlight);
                        }
                        else
                        {
                            // Should we try to late weave?
                            // DANGER DANGER: Magic number:
                            //let fof_is_not_early = cp.cdTracker.statusOf(Actions.FightOrFlight).readyAt.relative > 1.0;

                            // if we are on an even minute, and we're 98ing
                            if ((strategy_98_alt && even_minute) || strategy_always9)
                            {
                                const readyAt = cp.cdTracker.statusOf(Actions.FightOrFlight).readyAt.absolute;
                                cp.addSpecialRow(`>> Late Weaving FOF!`);
                                // if force is on, we are here because we are clipping our GCD:
                                if (strategy_98_force)
                                {
                                    if (!cp.canUseWithoutClipping(Actions.FightOrFlight))
                                    {
                                        const beforeGCD = cp.nextGcdTime;
                                        cp.delayForOgcd(Actions.FightOrFlight);
                                        const clip_amount = cp.nextGcdTime - beforeGCD;
                                        cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clip_amount).toFixed(2) + "s");
                                        clip_total_time += clip_amount;
                                    }
                                    else
                                    {
                                        cp.useOgcdLateWeave(Actions.FightOrFlight);
                                    }

                                }
                                else
                                {
                                    // a normal late weave is fine:
                                    cp.useOgcdLateWeave(Actions.FightOrFlight);
                                }
                                if (fofs_used != 0)
                                    cp.addSpecialRow(`>> Delay to FOF: ` + (cp.currentTime - readyAt - STANDARD_ANIMATION_LOCK).toFixed(2) + "s");
                            }
                            else
                            {
                                cp.addSpecialRow(`Using FOF ASAP`);
                                cp.useOgcd(Actions.FightOrFlight);
                            }
                        }

                        if (fofs_used == 0)
                            time_of_first_fof = cp.currentTime;
                        fofs_used++;
                            time_of_last_fof = cp.currentTime;


                        let oGCDcounter = 0;

                        // TODO: Intervene will be available earlier than other other oGCDs after a certain point:
                        const ogcdOrder = [Actions.Imperator, Actions.CircleOfScorn, Actions.Expiacion,
                        Actions.Intervene,Actions.Intervene];

                        /////////////////
                        // We have now entered burst: perform all burst actions:

                        // Sks Pattern Detection:
                        if (strategy_250 || strategy_hubris || cp.canUseWithoutClipping(Actions.Imperator))
                        {
                            // In this case, we definitely haven't late weaved
                            // Set counter to 1, as we will have already used our burst first oGCD
                            oGCDcounter = 1;

                            if (strategy_hubris)
                            {
                                let is_gonna_clip = false;
                                const beforeGCD = cp.nextGcdTime;
                                // If we're specifically pretending SKS doesn't exist, delay for Req+
                                if (!cp.canUseWithoutClipping(Actions.Imperator))
                                    is_gonna_clip = true;

                                cp.delayForOgcd(Actions.Imperator);

                                if (is_gonna_clip)
                                {
                                    const clip_amount = cp.nextGcdTime - beforeGCD;
                                    cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clip_amount).toFixed(2) + "s");
                                    clip_total_time += clip_amount;
                                }
                                
                            }
                            else
                            {
                                cp.useOgcd(Actions.Imperator);
                            }
                        }
                        else
                        {
                            // we could not use imperator before, so we must melee first GCD
                            // The easiest way to check this is simply, is oGCDcounter 1 or not?
                        }

                        // In this situation, we have given ourselves the req buff in the same
                        // weave window as FOF.
                        // This seems like a weird way to discern this but it makes it easier
                        // to steer the strategy_minimise pathway down here:

                        if (oGCDcounter == 1)
                        {
                            // This burst is suggested to start blades early, to help avoid
                            // a situation where we lose BladeOfHonor due to phasing/death etc
                            cp.useGcd(Actions.Confiteor);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.BladeOfFaith);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.BladeOfTruth);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.BladeOfValor);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useOgcd(Actions.BladeOfHonor);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.GoringBlade);
                        }
                        // In this situation, we have not yet been able to give ourselves
                        // req stacks. We *may* have late weaved FOF:
                        else
                        {
                            cp.useGcd(Actions.GoringBlade);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.Confiteor);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.BladeOfFaith);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.BladeOfTruth);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useGcd(Actions.BladeOfValor);
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);
                            cp.useOgcd(Actions.BladeOfHonor);
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

                        while (enough_time_if_melee && safety < 100000)
                        {
                            safety++;
                            // Note the current status:
                            if (!strategy_250)
                                cp.addSpecialRow(`>> FOF: ${fof_remaining}s, phys prio`); 
                            // Use a burst GCD
                            cp.useBurstFiller(prioritise_melee && (!sim.settings.perform12312OldPrio));
                            // Use any remaining oGCDs:
                            oGCDcounter = cp.useOgcdInOrder(ogcdOrder, oGCDcounter);

                            // Update our variables:
                            enough_time_if_melee = cp.fofIsActive((cp.nextGcdTime + physGCD));
                            fof_remaining = cp.getFOFRemaining().toFixed(3);
                        }

                        if (!strategy_250)
                            cp.addSpecialRow(`>> Final burst GCD margin: ${fof_remaining}s:`);
                        else
                            cp.addSpecialRow(`>> Final burst GCD:`);
                        cp.useBurstFiller(false);

                        only_cos_once_in_filler = true;
                        only_exp_once_in_filler = true;

                        // Our buffs have expired, burst is complete:
                        // Flip even minute state:
                        even_minute = !even_minute;
                        force_next_burst = false;

                        if (strategy_98_alt)
                        {
                            if (even_minute)
                                cp.addSpecialRow(`>> 9/8 Even min: Hold Atonement`);
                            else
                                cp.addSpecialRow(`>> 9/8 Odd min: Spend Atonement`);
                        }
                    }
                    
                    // If there are fewer than 20 seconds remaining in the user selected
                    // time window:
                    if (cp.remainingTime < 20 && !end_of_time_burn && !sim.settings.disableBurnDown)
                    {
                        cp.addSpecialRow("Less than 20s remain on sim!");
                        cp.addSpecialRow("Will now burn GCD resources.");
                        cp.addSpecialRow("Replace new combo w/HS in last 3 GCDs");
                        end_of_time_burn = true;
                    }

                    // This is the bit where we just use filler:
                    if (end_of_time_burn)
                    {
                        // we also replace 1s with hardcasts under 3 phys GCDs, preventing a new combo starting
                        cp.useBurstFiller(false, cp.remainingGcdTime < (physGCD * 3));
                    }
                    else
                        cp.useFiller((even_minute && strategy_98_alt) || strategy_always9, sim.settings.perform12312OldPrio);

                    // There are some circumstances where eg 2.47 will have these come off of
                    // cd when messing with FOF. Let's only use them once between bursts.
                    // Also: technically someone playing with hubris would clip these, too:
                    if (cp.canUseWithoutClipping(Actions.CircleOfScorn) && only_cos_once_in_filler)
                    {
                        cp.useOgcd(Actions.CircleOfScorn);
                        only_cos_once_in_filler = false;
                        if (strategy_hubris)
                        {
                            const beforeGCD = cp.nextGcdTime;
                            cp.delayForOgcd(Actions.Expiacion);
                            if ((cp.nextGcdTime - beforeGCD) > 0)
                            {
                                const clip_amount = cp.nextGcdTime - beforeGCD;
                                cp.addSpecialRow("! ALERT ! Clipped GCD! " + (clip_amount).toFixed(2) + "s");
                                clip_total_time += clip_amount;
                            }
                            only_exp_once_in_filler = false;
                        }
                    }
                    if (cp.canUseWithoutClipping(Actions.Expiacion) && only_exp_once_in_filler)
                    {
                        cp.useOgcd(Actions.Expiacion);
                        only_exp_once_in_filler = false;
                    }
                }

                const fof_delta = (time_of_last_fof - time_of_first_fof) - ((fofs_used - 1) * 60);
                const avg_delay_fof = fof_delta / fofs_used;

                cp.addSpecialRow(">> Summaries:");

                cp.addSpecialRow("Number of FOFs: " + fofs_used.toFixed(0));
                cp.addSpecialRow("Net FOF delay by end: " + fof_delta.toFixed(2));
                cp.addSpecialRow("Average delay: " + avg_delay_fof.toFixed(2));
                if (avg_delay_fof > 0.01)
                {
                    const three_gcd_delay = 7.5 / avg_delay_fof;
                    cp.addSpecialRow("Burst hits 7.5s delay @ ~" + three_gcd_delay.toFixed(0) + "m");
                    cp.addSpecialRow("Delay interacts with Party Buffs.");
                }
                if (clip_total_time > 0.01)
                {
                    cp.addSpecialRow("! ALERT !: Total clip time: " + clip_total_time.toFixed(2) + "s");
                    cp.addSpecialRow("Avg of " + ((clip_total_time / cp.currentTime) * 60).toFixed(2) + "s Clip every min");
                }
            }

        }]
    }

}