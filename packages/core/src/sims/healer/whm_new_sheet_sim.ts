import {
    Ability,
    BuffController,
    GcdAbility,
    HasGaugeCondition,
    HasGaugeUpdate,
    OgcdAbility,
    PersonalBuff,
    SimSettings,
    SimSpec
} from "@xivgear/core/sims/sim_types";
import {
    AbilityUseResult,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    GaugeManager,
    MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import {rangeInc} from "@xivgear/util/array_utils";
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";

export type WhmGaugeState = {
    level: number;
    blueLilies: number;
    redLilies: number;
}

const filler: GcdAbility = {
    id: 25859,
    type: 'gcd',
    name: "Glare III",
    potency: 350,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
};

const dia: GcdAbility = {
    id: 16532,
    type: 'gcd',
    name: "Dia",
    potency: 85,
    dot: {
        id: 1871,
        tickPotency: 85,
        duration: 30,
    },
    attackType: "Spell",
    gcd: 2.5,
};

const assize: OgcdAbility = {
    id: 3571,
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability",
    cooldown: {
        time: 40,
    },
};

export const SacredSight: PersonalBuff = {
    name: "Sacred Sight",
    saveKey: "Sacred Sight",
    duration: 30,
    stacks: 3,
    selfOnly: true,
    effects: {
        // Allows 1 use of Glare IV per stack
    },
    statusId: 3879,
    appliesTo: ability => ability.id === glare4.id,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.subtractStacksSelf(1);
        return {
            ...ability,
        };
    },
};

const pom: OgcdAbility = {
    id: 136,
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [
        {
            name: "Presence of Mind",
            selfOnly: true,
            duration: 15,
            effects: {
                haste: 20,
            },
            statusId: 157,
        },
        SacredSight,
    ],
    attackType: "Ability",
    cooldown: {
        time: 120,
    },
};

const lily: GcdAbility & HasGaugeUpdate<WhmGaugeManager> & HasGaugeCondition<WhmGaugeManager> = {
    id: 16534,
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
    gaugeConditionSatisfied(gaugeManager: WhmGaugeManager): boolean {
        return gaugeManager.blueLilies >= 1;
    },
    updateGauge: (gauge: WhmGaugeManager) => {
        gauge.blueLilies -= 1;
        gauge.redLilies += 1;
    },
};

const misery: GcdAbility & HasGaugeUpdate<WhmGaugeManager> & HasGaugeCondition<WhmGaugeManager> = {
    id: 16535,
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1400,
    attackType: "Spell",
    gcd: 2.5,
    updateGauge: gauge => gauge.redLilies -= 3,
    gaugeConditionSatisfied(gaugeManager: WhmGaugeManager): boolean {
        return gaugeManager.redLilies >= 3;
    },
};

const glare4: GcdAbility = {
    id: 37009,
    type: 'gcd',
    name: "Glare IV",
    potency: 640,
    attackType: "Spell",
    gcd: 2.5,
};

class WhmGaugeManager implements GaugeManager<WhmGaugeState> {
    private _blueLilies: number = 0;
    private _redLilies: number = 3;

    get blueLilies(): number {
        return this._blueLilies;
    }

    // TODO: questionable if this is still needed since we have preconditions for gauge skills
    set blueLilies(newLily: number) {
        if (newLily < 0) {
            console.warn(`Used a lily when unavailable`);
        }
        this._blueLilies = Math.max(Math.min(newLily, 3), 0);
    }

    get redLilies(): number {
        return this._redLilies;
    }

    set redLilies(newLily: number) {
        if (newLily < 0) {
            console.warn(`Used misery with blood lily not charged`);
        }
        this._redLilies = Math.max(Math.min(newLily, 3), 0);
    }

    gaugeSnapshot(): WhmGaugeState {
        return {
            level: 100,
            blueLilies: this.blueLilies,
            redLilies: this.redLilies,
        };
    }
}

export interface WhmSimResult extends CycleSimResult<WhmGaugeState> {
}

export interface WhmSettings extends SimSettings {

}

export interface WhmSettingsExternal extends ExternalCycleSettings<WhmSettings> {

}

export const whmNewSheetSpec: SimSpec<WhmSim, WhmSettingsExternal> = {
    displayName: "WHM Sim",
    loadSavedSimInstance(exported: WhmSettingsExternal) {
        return new WhmSim(exported);
    },
    makeNewSimInstance(): WhmSim {
        return new WhmSim();
    },
    stub: "whm-new-sheet-sim",
    supportedJobs: ['WHM'],
    isDefaultSim: true,
};

class WhmCycleProcessor extends CycleProcessor<WhmGaugeManager> {
    nextDiaTime: number = 0;
    nextLilyTime: number = 20;
    nextMiseryTime: number = 60;
    sacredSight: number = 0;

    constructor(settings: MultiCycleSettings) {
        super(settings);
    }

    override createGaugeManager(): WhmGaugeManager {
        return new WhmGaugeManager();
    }

    override use(ability: Ability): AbilityUseResult {
        // TODO: might be useful to include this in gaugeManager
        if (this.nextGcdTime > this.nextLilyTime) {
            this.nextLilyTime += 20;
            this.gaugeManager.blueLilies += 1;
        }
        return super.use(ability);
    }

    buffedGcd() {
        if (this.nextGcdTime >= this.nextDiaTime && this.remainingTime > 15) {
            this.nextDiaTime = this.nextGcdTime + 28.8;
            this.useGcd(dia);
        }
        else if (this.gaugeManager.redLilies === 3) {
            this.useGcd(misery);
        }
        else if (this.sacredSight > 0) {
            this.useGcd(glare4);
            this.sacredSight -= 1;
        }
        else {
            this.useGcd(filler);
        }
    }

    unbuffedGCD(): AbilityUseResult {
        if (this.nextGcdTime >= this.nextDiaTime && this.remainingTime > 15) {
            this.nextDiaTime = this.nextGcdTime + 28.8;
            return this.useGcd(dia);
        }
        else if ((this.gaugeManager.redLilies === 3 && this.nextMiseryTime % 120 === 0) //use odd minute misery ASAP
            || (this.gaugeManager.redLilies === 3 && this.remainingTime < 5)) { //or use misery if the fight will end now
            return this.useGcd(misery);
        }
        else if (this.gaugeManager.redLilies < 3 && this.gaugeManager.blueLilies > 0 && this.totalTime > this.nextMiseryTime + 7) {
            const out = this.useGcd(lily);
            if (this.gaugeManager.redLilies === 3) {
                this.nextMiseryTime += 60;
            }
            return out;
        }
        else {
            return this.useGcd(filler);
        }
    }

    useTwoMinBurst() {
        this.use(pom);
        this.sacredSight = 3;
        for (let i = 0; i < 12; i++) {
            this.buffedGcd();
            if (this.isReady(assize)) {
                this.use(assize);
            }
        }
    }
}

export class WhmSim extends BaseMultiCycleSim<WhmSimResult, WhmSettings, WhmCycleProcessor> {

    makeDefaultSettings(): WhmSettings {
        return {};
    }

    spec = whmNewSheetSpec;
    displayName = whmNewSheetSpec.displayName;
    shortName = "whm-new-sheet-sim";

    constructor(settings?: WhmSettingsExternal) {
        super('WHM', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): WhmCycleProcessor {
        return new WhmCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            name: 'Normal DoT',
            cycleTime: 120,
            apply(cp: WhmCycleProcessor) {
                cp.use(filler); //prepull glare
                cp.oneCycle(cycle => {
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    while (!cp.isReady(pom)) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
            },
        }, ...rangeInc(10, 28, 2).map(i => ({
            name: `Redot at ${i}s`,
            cycleTime: 120,
            apply(cp: WhmCycleProcessor) {
                cp.useGcd(filler);
                cp.useGcd(dia);
                cp.nextDiaTime = i;
                cp.oneCycle(cycle => {
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    while (!cp.isReady(pom)) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
            },
        })), ...rangeInc(2, 16, 2).map(i => ({
            name: `Delay dot to ${i}s`,
            cycleTime: 120,
            apply(cp: WhmCycleProcessor) {
                cp.use(filler);
                cp.nextDiaTime = i;
                cp.oneCycle(cycle => {
                    cp.unbuffedGCD();
                    cp.unbuffedGCD();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    while (!cp.isReady(pom)) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        const result = cp.unbuffedGCD();
                        if (result === 'none') {
                            return;
                        }
                        if (cp.isReady(assize)) {
                            cp.use(assize);
                        }
                    }
                });
            },
        })),
        ];
    }
}
