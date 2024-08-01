import {Chain} from "@xivgear/core/sims/buffs";
import {GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
import {gemdraught1mind} from "@xivgear/core/sims/common/potion";
import {FieldBoundIntField} from "@xivgear/common-ui/components/util";
import {rangeInc} from "@xivgear/core/util/array_utils";
import {animationLock} from "@xivgear/core/sims/ability_helpers";

const filler: GcdAbility = {
    type: 'gcd',
    name: "Broil IV",
    id: 25865,
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
};

const chain: OgcdAbility = {
    type: 'ogcd',
    name: "Chain Strategem",
    id: 7436,
    activatesBuffs: [Chain],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120
    }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const r2: GcdAbility = {
    type: 'gcd',
    name: "Ruin II",
    id: 17870,
    potency: 220,
    attackType: "Spell",
    gcd: 2.5,
};

const bio: GcdAbility = {
    type: 'gcd',
    name: "Biolysis",
    id: 16540,
    potency: 0,
    dot: {
        duration: 30,
        tickPotency: 75,
        // TODO verify
        id: 3089
    },
    attackType: "Spell",
    gcd: 2.5,
};

const baneful: OgcdAbility = {
    type: 'ogcd',
    name: "Baneful Impaction",
    id: 37012,
    potency: 0,
    dot: {
        duration: 15,
        tickPotency: 140,
        // TODO verify
        id: 3883
    },
    attackType: "Ability"
};

const ed: OgcdAbility = {
    type: 'ogcd',
    name: "Energy Drain",
    id: 167,
    potency: 100,
    attackType: "Ability"
};

const aetherflow: OgcdAbility = {
    type: 'ogcd',
    name: "Aetherflow",
    id: 166,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 60
    }
}

const diss: OgcdAbility = {
    type: 'ogcd',
    name: "Dissipation",
    id: 3587,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 180
    }
}

export interface SchSheetSimResult extends CycleSimResult {
}

export interface SchSettings extends SimSettings {
    edPerAfDiss: number,
}

export interface SchSettingsExternal extends ExternalCycleSettings<SchSettings> {
}

export const schNewSheetSpec: SimSpec<SchSheetSim, SchSettingsExternal> = {
    displayName: "SCH Sim",
    loadSavedSimInstance(exported: SchNewSheetSettingsExternal) {
        return new SchSheetSim(exported);
    },
    makeNewSimInstance(): SchSheetSim {
        return new SchSheetSim();
    },
    stub: "sch-sheet-sim",
    supportedJobs: ['SCH'],
    isDefaultSim: true
};

class ScholarCycleProcessor extends CycleProcessor {
    nextBioTime: number = 0;
    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cdEnforcementMode = 'delay';
    }

    useDotIfWorth() {
        if (this.remainingTime > 15 && this.currentTime > this.nextBioTime) {
            this.use(bio);
            this.nextBioTime = this.currentTime + 29;
        }
        else {
            this.use(filler);
        }
    }

    spendEDs(){
        if(this.edPerAfDiss>=1) {
            cycle.useDotIfWorth();
            cycle.use(ed);
            if(this.edPerAfDiss>=2) {
                cycle.useDotIfWorth();
                cycle.use(ed);
                if(this.edPerAfDiss>=3) {
                    cycle.useDotIfWorth();
                    cycle.use(ed);
                }
            }
        }
    }

    TwoMinBurst(){
        cycle.use(chain);
        cycle.spendEDs();
        cycle.useDotIfWorth();
        cycle.use(aetherflow);
        cycle.useDotIfWorth();
        cycle.use(baneful);
        cycle.spendEDs();
    }
}

export class SchSheetSim extends BaseMultiCycleSim<SchSheetSimResult, SchNewSheetSettings, ScholarCycleProcessor> {

    spec = schNewSheetSpec;
    displayName = schNewSheetSpec.displayName;
    shortName = "sch-sheet-sim";
    manuallyActivatedBuffs = [Chain];

    constructor(settings?: SchSettingsExternal) {
        super('SCH', settings);
    }

    makeDefaultSettings(): SchSettings {
        return {
            edPerAfDiss = 3
        };
    }

    makeCustomConfigInterface(settings: SchSettings, updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const edField = new FieldBoundIntField(SchSettings, 'edPerAfDiss', {
            inputMode: 'number',
            postValidators: [nonNegative]
        });
        edField.id = 'edField';
        const label = labelFor('Energy Drains per Aetherflow/Dissipation', edField);
        return configDiv;
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: ScholarCycleProcessor) {
                // pre-pull
                cp.use(filler);
                cycle.use(bio);
                this.nextBioTime = this.currentTime + 29;
                cp.use(diss);
                cp.remainingCycles(cycle => {
                    cycle.use(filler);
                    cycle.TwoMinBurst();
                    while(this.cycleRemainingTime > 0) {
                        this.useDotIfWorth();
                        if(cp.isReady(aetherflow)){
                            cp.use(aetherflow);
                            if(cycle.cycleNumber % 3 === 2)
                                cycle.spendEDs();
                        }
                        if(cp.isReady(diss)){
                            cp.use(diss);
                            if(cycle.cycleNumber % 3 === 1)
                                cycle.spendEDs();
                        }
                    }
                });
            }
        }, ...rangeInc(2, 20, 2).map(i => ({
            name: `DoT clip ${i}s`,
            cycleTime: 120,
            apply(cp: ScholarCycleProcessor) {
                this.nextBioTime = i;
                cp.useGcd(filler);
                cp.remainingCycles(cycle => {
                    cycle.use(filler);
                    cycle.TwoMinBurst();
                    while(this.cycleRemainingTime > 0) {
                        this.useDotIfWorth();
                        if(cp.isReady(aetherflow)){
                            cp.use(aetherflow);
                            if(cycle.cycleNumber % 3 === 2)
                                cycle.spendEDs();
                        }
                        if(cp.isReady(diss)){
                            cp.use(diss);
                            if(cycle.cycleNumber % 3 === 1)
                                cycle.spendEDs();
                        }
                    }
                });
            },
        }))
        ]
    }
}
