import {Divination} from "@xivgear/core/sims/buffs";
import {Ability, BuffController, GcdAbility, OgcdAbility, PersonalBuff, SimSettings, SimSpec, PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, Rotation, DisplayRecordFinalized,
    isFinalizedAbilityUse, PreDmgAbilityUseRecordUnf, AbilityUseResult} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
import {rangeInc} from "@xivgear/core/util/array_utils";
//import {potionMaxMind} from "@xivgear/core/sims/common/potion";
import {CustomColumnSpec} from "../../tables";
import {AbilitiesUsedTable} from "../components/ability_used_table";

type AstAbility = Ability & Readonly<{
    /** Run if an ability needs to update the aetherflow gauge */
    updateGauge?(gauge: AstGauge): void;
}>

type AstGcdAbility = GcdAbility & AstAbility;

type AstOgcdAbility = OgcdAbility & AstAbility;

type AstGaugeState = {
    level: number;
    cards: Set<string>;
}

export type AstExtraData = {
    gauge: AstGaugeState;
}

const filler: AstGcdAbility = {
    id: 25871,
    type: 'gcd',
    name: "Fall Malefic",
    potency: 270,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
};

const combust: AstGcdAbility = {
    id: 16554,
    type: 'gcd',
    name: "Combust III",
    potency: 0,
    dot: {
        id: 2041,
        tickPotency: 70,
        duration: 30
    },
    attackType: "Spell",
    gcd: 2.5,
};

const star: AstOgcdAbility = {
    id: 7439,
    type: 'ogcd',
    name: "Earthly Star",
    potency: 310,
    attackType: "Ability",
    cooldown: {
        time: 60
    }
};

export const Divining: PersonalBuff = {
    name: "Divining",
    saveKey: "Divining",
    duration: 30,
    selfOnly: true,
    effects: {
        // Allows use of Oracle
    },
    statusId: 3893,
    appliesTo: ability => ability.id == oracle.id,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        buffController.removeSelf();
        return {
            ...ability,
        };
    },
}

const div: AstOgcdAbility = {
    type: 'ogcd',
    name: "Divination",
    id: 16552,
    activatesBuffs: [Divination, Divining],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120
    }
};

const oracle: AstOgcdAbility = {
    type: 'ogcd',
    name: "Oracle",
    id: 37029,
    potency: 860,
    attackType: "Ability"
};

/*const astrodyne: AstOgcdAbility = {
    id: 25870,
    name: "Astrodyne",
    type: "ogcd",
    potency: null,
    activatesBuffs: [
        {
            name: "Astrodyne",
            selfOnly: true,
            duration: 15,
            effects: { //currently assumes 2 seal dynes, can change dmgIncrease based on frequency of 3 seals
                // dmgIncrease: 0.00,
                haste: 10,
            },
        }
    ],
    attackType: "Ability",
};*/

export const LightspeedBuff: PersonalBuff = {
    duration: 15,
    effects: {},
    name: "Lightspeed",
    selfOnly: true,
    descriptionOverride: "Instant casts for 15 seconds",
    beforeAbility<X extends Ability>(controller: BuffController, ability: X): X | null {
        if (ability.type === 'gcd' && ability.cast >= 0) {
            return {
                ...ability,
                cast: ability.cast - 2.5,
            }
        }
        return null;
    },
    statusId: 841
};

const ls: AstOgcdAbility = {
    type: 'ogcd',
    name: "Lightspeed",
    id: 3606,
    activatesBuffs: [LightspeedBuff],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 60,
        charges: 2
    }
}

const astralDraw: AstOgcdAbility = {
    type: 'ogcd',
    name: "Astral Draw",
    id: 37017,
    potency: 0,
    attackType: "Ability",
    updateGauge: (gauge: AstGauge) => {
        gauge.clearCards();
        gauge.addCard("Balance");
        gauge.addCard("Arrow");
        gauge.addCard("Spire");
        gauge.addCard("Lord");
    },
};

const umbralDraw: AstOgcdAbility = {
    type: 'ogcd',
    name: "Umbral Draw",
    id: 37018,
    potency: 0,
    attackType: "Ability",
    updateGauge: (gauge: AstGauge) => {
        gauge.clearCards();
        gauge.addCard("Spear");
        gauge.addCard("Bole");
        gauge.addCard("Ewer");
        gauge.addCard("Lady");
    },
};

const lord: AstOgcdAbility = {
    id: 7444,
    type: 'ogcd',
    name: "Lord of Crowns",
    potency: 400,
    attackType: "Ability",
    updateGauge: (gauge: AstGauge) => {
        gauge.playCard("Lord");
    },
};

const balance: AstOgcdAbility = {
    type: 'ogcd',
    name: "The Balance",
    id: 37023,
    potency: 0,
    attackType: "Ability",
    updateGauge: (gauge: AstGauge) => {
        gauge.playCard("Balance");
    },
};

const spear: AstOgcdAbility = {
    type: 'ogcd',
    name: "The Spear",
    id: 37026,
    potency: 0,
    attackType: "Ability",
    updateGauge: (gauge: AstGauge) => {
        gauge.playCard("Spear");
    },
};

class AstGauge {
    private _cards: Set<string> = new Set<string>();
    get cards() {
        return this._cards;
    }
    set cards(newCards: Set<string>) {
        this._cards = newCards;
    }

    addCard(newCard: string){
        this._cards.add(newCard);
    }
    playCard(played: string){
        this._cards.delete(played);
    }
    clearCards(){
        this._cards.clear();
    }


    getGaugeState(): AstGaugeState {
        return {
            level: 100,
            cards: new Set([...this.cards]),
        }
    }

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'cards',
            displayName: 'Cards',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const cards = (usedAbility.extraData as AstExtraData).gauge.cards;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.justifyContent = 'center';
                    div.style.gap = '4px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const cardStyles = {
                        Balance: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#ff6f00',
                        },
                        Arrow: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#69ebff',
                        },
                        Spire: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#fff700',
                        },
                        Lord: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#bd040a',
                        },
                        Spear: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#0059ff',
                        },
                        Bole: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#00bd23',
                        },
                        Ewer: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#00ddff',
                        },
                        Lady: {
                            clipPath: `polygon(15% 0%, 85% 0%, 85% 100%, 15% 100%)`,
                            background: '#ffe4d6',
                        }
                    };

                    Object.keys(cardStyles).forEach(key => {
                        const stack = document.createElement('span');
                        for (const [k, v] of Object.entries(cardStyles[key])) {
                            stack.style[k] = v;
                        }
                        stack.style.height = '100%';
                        stack.style.width = '16px';
                        stack.style.display = 'inline-block';
                        stack.style.overflow = 'hidden';
                        if (!cards.has(key)) {
                            stack.style.background = '#00000033';
                        }
                        div.appendChild(stack);
                    });

                    return div;
                }
                return document.createTextNode("");
            }
        },
        ];
    }
}

export interface AstSimResult extends CycleSimResult {
}

export interface AstSettings extends SimSettings {

}

export interface AstSettingsExternal extends ExternalCycleSettings<AstSettings> {

}

export const astNewSheetSpec: SimSpec<AstSim, AstSettingsExternal> = {
    displayName: "AST Sim",
    loadSavedSimInstance(exported: AstSettingsExternal) {
        return new AstSim(exported);
    },
    makeNewSimInstance(): AstSim {
        return new AstSim();
    },
    stub: "ast-sheet-sim",
    supportedJobs: ['AST'],
    isDefaultSim: true
};

class AstCycleProcessor extends CycleProcessor {
    gauge: AstGauge;
    nextCombustTime: number = 0;
    nextDrawTime: number = 0;
    drawState: number = 0;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.gauge = new AstGauge();
        this.gauge.addCard("Balance");
        this.gauge.addCard("Arrow");
        this.gauge.addCard("Spire");
        this.gauge.addCard("Lord");
    }

    override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf) {
        // Add gauge data to this record for the UI
        const extraData: AstExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }
    
    override use(ability: Ability): AbilityUseResult {
        const astAbility = ability as AstAbility;
        
        // Update gauge from the ability itself
        if (astAbility.updateGauge !== undefined) {
            astAbility.updateGauge(this.gauge);
        }
        return super.use(ability);
    }

    useDotIfWorth() {
        if (this.nextGcdTime >= this.nextCombustTime && this.remainingTime > 15) {
            this.nextCombustTime = this.nextGcdTime + 28.8;
            this.useGcd(combust);
        }
        else {
            this.useGcd(filler);
        }
    }

    Draw() {
        this.nextDrawTime = this.currentTime + 55;
        if (this.drawState == 0) {
            this.use(umbralDraw);
            this.drawState++;
        } else if (this.drawState == 1) {
            this.use(astralDraw);
            this.drawState = 0;
        }
    }

    useTwoMinBurst() {
        this.use(ls);

        this.useDotIfWorth();
        this.use(div);
        //let oracleReady = true;
        this.use(balance);

        this.useDotIfWorth();
        this.use(lord);
        this.Draw();

        this.useDotIfWorth();
        this.use(spear);
        this.use(oracle);
        //oracleReady = false;

        this.useDotIfWorth();
        this.use(star);
    }
}

export class AstSim extends BaseMultiCycleSim<AstSimResult, AstSettings, AstCycleProcessor> {

    makeDefaultSettings(): AstSettings {
        return {

        }
    };

    spec = astNewSheetSpec;
    displayName = astNewSheetSpec.displayName;
    shortName = "ast-sheet-sim";
    manuallyActivatedBuffs = [Divination];

    constructor(settings?: AstSettingsExternal) {
        super('AST', settings);
    }

    protected createCycleProcessor(settings: MultiCycleSettings): AstCycleProcessor {
        return new AstCycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }

    override makeAbilityUsedTable(result: AstSimResult): AbilitiesUsedTable {
        const extraColumns = AstGauge.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            name: 'Normal DoT',
            cycleTime: 120,
            apply(cp: AstCycleProcessor) {
                cp.use(filler); //prepull malefic
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    cp.useDotIfWorth();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(star)) {
                            cp.use(star);
                        } else if (cp.currentTime > cp.nextDrawTime && cp.drawState == 1) {
                            cp.Draw();
                            if (cp.remainingTime < cp.timeUntilReady(div)) {
                                cp.useDotIfWorth();
                                cp.use(lord);
                            }
                        }
                    }
                })
            }
        },
        ...rangeInc(10, 28, 2).map(i => ({
            name: `Redot at ${i}s`,
            cycleTime: 120,
            apply(cp: AstCycleProcessor) {
                cp.useGcd(filler);
                cp.useGcd(combust);
                cp.nextCombustTime = i;
                cp.oneCycle(cycle => {
                    cp.useDotIfWorth();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(star)) {
                            cp.use(star);
                        } else if (cp.currentTime > cp.nextDrawTime && cp.drawState == 1) {
                            cp.Draw();
                            if (cp.remainingTime < cp.timeUntilReady(div)) {
                                cp.useDotIfWorth();
                                cp.use(lord);
                            }
                        }
                    }
                });
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    cp.useDotIfWorth();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(star)) {
                            cp.use(star);
                        } else if (cp.currentTime > cp.nextDrawTime && cp.drawState == 1) {
                            cp.Draw();
                            if (cp.remainingTime < cp.timeUntilReady(div)) {
                                cp.useDotIfWorth();
                                cp.use(lord);
                            }
                        }
                    }
                });
            },
        })),
        ...rangeInc(2, 16, 2).map(i => ({
            name: `Delay dot to ${i}s`,
            cycleTime: 120,
            apply(cp: AstCycleProcessor) {
                cp.use(filler);
                cp.nextCombustTime = i;
                cp.remainingCycles(cycle => {
                    cp.useDotIfWorth();
                    cp.useDotIfWorth();
                    cp.useTwoMinBurst();
                    while (cycle.cycleRemainingGcdTime > 0) {
                        cp.useDotIfWorth();
                        if (cp.isReady(star)) {
                            cp.use(star);
                        } else if (cp.currentTime > cp.nextDrawTime && cp.drawState == 1) {
                            cp.Draw();
                            if (cp.remainingTime < cp.timeUntilReady(div)) {
                                cp.useDotIfWorth();
                                cp.use(lord);
                            }
                        }
                    }
                })
            },
        }))
    ];
    }
}
