import {Chain} from "@xivgear/core/sims/buffs";
import {GcdAbility, OgcdAbility, Ability, UsedAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation,
    DisplayRecordFinalized,
    isFinalizedAbilityUse,
    AbilityUseRecordUnf,
    AbilityUseResult
} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
//import {gemdraught1mind} from "@xivgear/core/sims/common/potion";
import {FieldBoundIntField, labelFor, nonNegative} from "@xivgear/common-ui/components/util";
import {rangeInc} from "@xivgear/core/util/array_utils";
import {CustomColumnSpec} from "../../tables";
import { AbilitiesUsedTable } from "../components/ability_used_table";

type SchAbility = Ability & Readonly<{
    /** Run if an ability needs to update the aetherflow gauge */
    updateGauge?(gauge: SchGauge): void;
}>

//type SchGcdAbility = GcdAbility & SchAbility;

type SchOgcdAbility = OgcdAbility & SchAbility;

type SchGaugeState = {
    level: number;
    aetherflow: number;
}

type SchExtraData = {
    gauge: SchGaugeState;
}

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
    attackType: "Ability",
};

const ed: SchOgcdAbility = {
    type: 'ogcd',
    name: "Energy Drain",
    id: 167,
    potency: 100,
    attackType: "Ability",
    updateGauge: gauge => gauge.aetherflow -= 1,
};

const aetherflow: SchOgcdAbility = {
    type: 'ogcd',
    name: "Aetherflow",
    id: 166,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 60
    },
    updateGauge: gauge => gauge.aetherflow = 3,
}

const diss: SchOgcdAbility = {
    type: 'ogcd',
    name: "Dissipation",
    id: 3587,
    potency: 0,
    attackType: "Ability",
    cooldown: {
        time: 180
    },
    updateGauge: gauge => gauge.aetherflow = 3,
}

class SchGauge {
    private _aetherflow: number = 0;
    get aetherflow(): number {
        return this._aetherflow;
    }
    set aetherflow(newAF: number) {
        if (newAF < 0) {
            console.warn(`Used Energy Drain when empty`)
        }

        this._aetherflow = Math.max(Math.min(newAF, 3), 0);
    }


    getGaugeState(): SchGaugeState {
        return {
            level: 100,
            aetherflow: this.aetherflow,
        }
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'aetherflow',
            displayName: 'Aetherflow',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: UsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const aetherflow = (usedAbility.extraData as SchExtraData).gauge.aetherflow;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    div.style.gap = '4px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    for (let i = 1; i <= 3; i++) {
                        const stack = document.createElement('span');
                        stack.style.clipPath = `polygon(0 50%, 50% 0, 100% 50%, 50% 100%, 0% 50%)`;
                        stack.style.background = '#00000033';
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (i <= aetherflow) {
                            stack.style.background = '#0FFF33';
                        }
                        div.appendChild(stack);
                    }

                    return div;
                }
                return document.createTextNode("");
            }
        },
        ];
    }
}

export interface SchSimResult extends CycleSimResult {
}

export interface SchSettings extends SimSettings {
    edPerAfDiss: number,
}

export interface SchSettingsExternal extends ExternalCycleSettings<SchSettings> {
}

export const schNewSheetSpec: SimSpec<SchSheetSim, SchSettingsExternal> = {
    displayName: "SCH Sim",
    loadSavedSimInstance(exported: SchSettingsExternal) {
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
    MySettings: SchSettings;
    gauge: SchGauge;
    nextBioTime: number = 0;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new SchGauge();
    }
    
    override addAbilityUse(usedAbility: AbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: SchExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: AbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }
    
    override use(ability: Ability): AbilityUseResult {
        const schAbility = ability as SchAbility;
        
        // Update gauge from the ability itself
        if (schAbility.updateGauge !== undefined) {
            schAbility.updateGauge(this.gauge);
        }
        return super.use(ability);
    }

    useDotIfWorth() {
        if (this.currentTime > this.nextBioTime && this.remainingTime > 15) {
            this.nextBioTime = this.currentTime + 28.8;
            this.use(bio);
        }
        else {
            this.use(filler);
        }
    }

    spendEDs(numED: number) {
        this.useDotIfWorth();
        if (numED >= 1) {
            this.use(ed);
        }
        this.useDotIfWorth();
        if (numED >= 2) {
            this.use(ed);
        }
        this.useDotIfWorth();
        if (numED >= 3) {
            this.use(ed);
        }
    }

    TwoMinBurst(numED: number) {
        this.use(chain);
        let banefulReady = true;
        if (this.remainingTime < 30) { //rush baneful if there's not enough time for it to tick
            this.use(filler);
            this.use(baneful);
            banefulReady = false;
        }
        this.spendEDs(numED);
        this.useDotIfWorth();
        this.use(aetherflow);
        this.useDotIfWorth();
        if (banefulReady) { //if baneful was not rushed
            this.use(baneful);
        }
        this.spendEDs(numED);
    }
}

export class SchSheetSim extends BaseMultiCycleSim<SchSimResult, SchSettings, ScholarCycleProcessor> {

    spec = schNewSheetSpec;
    displayName = schNewSheetSpec.displayName;
    shortName = "sch-sheet-sim";
    manuallyActivatedBuffs = [Chain];

    constructor(settings?: SchSettingsExternal) {
        super('SCH', settings);
    }

    makeDefaultSettings(): SchSettings {
        return {
            edPerAfDiss: 3
        };
    }

    makeCustomConfigInterface(settings: SchSettings, updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");
        const edField = new FieldBoundIntField(settings, 'edPerAfDiss', {
            inputMode: 'number',
            postValidators: [nonNegative]
        });
        edField.id = 'edField';
        const label = labelFor('Energy Drains per Aetherflow/Dissipation', edField);
        configDiv.appendChild(label);
        configDiv.appendChild(edField);
        return configDiv;
    }

    override makeAbilityUsedTable(result: SchSimResult): AbilitiesUsedTable {
        const extraColumns = SchGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

    protected createCycleProcessor(settings: MultiCycleSettings): ScholarCycleProcessor {
        return new ScholarCycleProcessor(settings);
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            name: "Normal DoT",
            apply(cp: ScholarCycleProcessor) {
                // pre-pull
                cp.use(filler);
                cp.nextBioTime = cp.currentTime + 28.8;
                cp.use(bio);
                cp.remainingCycles(cycle => {
                    if (cp.isReady(diss)) {
                        cp.use(diss);
                    }
                    cp.use(filler);
                    cp.TwoMinBurst(this.settings.edPerAfDiss);
                    while (cycle.cycleRemainingTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(aetherflow)) {
                            cp.use(aetherflow);
                            if (cycle.cycleNumber % 3 === 2) {
                                cp.spendEDs(this.settings.edPerAfDiss);
                            }
                        }
                        if (cp.isReady(diss)) {
                            cp.use(diss);
                            if (cycle.cycleNumber % 3 === 1) {
                                cp.spendEDs(this.settings.edPerAfDiss);
                            }
                        }
                    }
                });
            }
        },
            ...rangeInc(10, 28, 2).map(i => ({
            name: `Redot at ${i}s`,
            cycleTime: 120,
            apply(cp: ScholarCycleProcessor) {
                cp.use(filler);
                cp.use(bio);
                cp.nextBioTime = i;
                cp.remainingCycles(cycle => {
                    if (cp.isReady(diss)) {
                        cp.use(diss);
                    }
                    cp.use(filler);
                    cp.TwoMinBurst(this.settings.edPerAfDiss);
                    console.log(cycle.cycleRemainingTime);
                    while (cycle.cycleRemainingTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(aetherflow)) {
                            cp.use(aetherflow);
                            if (cycle.cycleNumber % 3 === 2) {
                                cp.spendEDs(this.settings.edPerAfDiss);
                            }
                        }
                        if (cp.isReady(diss)) {
                            cp.use(diss);
                            if (cycle.cycleNumber % 3 === 1) {
                                cp.spendEDs(this.settings.edPerAfDiss);
                            }
                        }
                    }
                });
            },
        }))
        ]
    }
}
