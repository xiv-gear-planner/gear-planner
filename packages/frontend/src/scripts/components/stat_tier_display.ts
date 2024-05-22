import {CharacterGearSet} from "@xivgear/core/gear";
import {STAT_ABBREVIATIONS, STAT_DISPLAY_ORDER} from "@xivgear/xivmath/xivconstants";
import {RawStatKey} from "@xivgear/xivmath/geartypes";
import {
    critDmg,
    detDmg,
    dhitChance,
    mainStatMulti,
    mpTick,
    sksTickMulti,
    sksToGcd,
    spsTickMulti,
    spsToGcd,
    tenacityDmg,
    vitToHp
} from "@xivgear/xivmath/xivmath";
import {GearPlanSheet} from "@xivgear/core/sheet";

interface Tiering {
    lower: number,
    upper: number
}

interface TieringDisplay {
    label: string,
    fullName: string,
    description: string,
    tiering: Tiering
}

export class SingleStatTierDisplay extends HTMLDivElement {
    private readonly lowerLeftDiv: HTMLDivElement;
    private readonly lowerRightDiv: HTMLDivElement;
    private readonly upperDiv: HTMLDivElement;

    constructor(private stat: RawStatKey) {
        super();
        // Upper area - name of stat/derived value
        this.classList.add('single-stat-tier-display');
        this.classList.add('stat-' + stat);
        this.upperDiv = document.createElement('div');
        this.upperDiv.classList.add('single-stat-tier-display-upper');
        this.appendChild(this.upperDiv);

        this.lowerLeftDiv = document.createElement('div');
        // Lower bound
        this.lowerLeftDiv.classList.add('single-stat-tier-display-lower-left');
        this.appendChild(this.lowerLeftDiv);
        // Upper bound
        this.lowerRightDiv = document.createElement('div');
        this.lowerRightDiv.classList.add('single-stat-tier-display-lower-right');
        this.appendChild(this.lowerRightDiv);
    }

    refresh(tiering: TieringDisplay): void {
        this.upperDiv.textContent = tiering.label;
        this.upperDiv.title = `${tiering.label}: ${tiering.description}`;
        if (tiering.tiering.lower > 0) {
            this.lowerLeftDiv.textContent = '-' + tiering.tiering.lower;
            this.classList.remove('stat-tiering-perfect');
            this.lowerLeftDiv.title = `Your ${tiering.fullName} is ${tiering.tiering.lower} above the next-lowest tier.\nIn other words, you could lose up to ${tiering.tiering.lower} points without negatively impacting your ${tiering.fullName}.`;
        }
        else {
            this.lowerLeftDiv.textContent = '✔';
            this.lowerLeftDiv.title = `Your ${tiering.fullName} is perfectly tiered.\nIf you lose any ${this.stat}, it will negatively impact your ${tiering.fullName}.`;
            this.classList.add('stat-tiering-perfect');
        }
        this.lowerRightDiv.textContent = '+' + tiering.tiering.upper;
        this.lowerRightDiv.title = `You must gain ${tiering.tiering.upper} points of ${this.stat} in order to increase your ${tiering.fullName}.`;
    }
}

export class StatTierDisplay extends HTMLDivElement {
    private readonly eleMap = new Map<string, SingleStatTierDisplay>();

    constructor(private sheet: GearPlanSheet) {
        super();
        this.classList.add('stat-tier-display');
    }

    refresh(gearSet: CharacterGearSet) {
        let relevantStats = STAT_DISPLAY_ORDER.filter(stat => this.sheet.isStatRelevant(stat));
        if (this.sheet.ilvlSync && !relevantStats.includes('vitality')) {
            relevantStats = ['vitality', ...relevantStats];
        }
        for (let stat of relevantStats) {
            try {
                const statTiering = this.getStatTiering(stat, gearSet);
                for (let tieringDisplay of statTiering) {
                    const key = tieringDisplay.label;
                    let singleStatTierDisplay: SingleStatTierDisplay;
                    if (this.eleMap.has(key)) {
                        singleStatTierDisplay = this.eleMap.get(key);
                    }
                    else {
                        singleStatTierDisplay = new SingleStatTierDisplay(stat);
                        this.eleMap.set(key, singleStatTierDisplay);
                        this.appendChild(singleStatTierDisplay);
                    }
                    singleStatTierDisplay.refresh(tieringDisplay);
                    // const tierDisplayNode = document.createElement('div');
                    // this.textContent += `${tieringDisplay.label}: -${tieringDisplay.tiering.lower} +${tieringDisplay.tiering.upper}; `;
                }
            }
            catch (e) {
                console.error("Error computing stat tiering", e);
            }
        }
    }


    getStatTiering(stat: RawStatKey, set: CharacterGearSet): TieringDisplay[] {
        const computed = set.computedStats;
        const levelStats = computed.levelStats;
        const jobStats = computed.jobStats;
        const curVal = computed[stat];
        const abbrev = STAT_ABBREVIATIONS[stat];
        switch (stat) {
            case "strength":
            case "dexterity":
            case "intelligence":
            case "mind":
                return [{
                    label: abbrev,
                    fullName: stat + ' multiplier',
                    description: 'Damage multiplier from primary stat',
                    tiering: this.getCombinedTiering(curVal, value => mainStatMulti(levelStats, jobStats, value))
                }];
            case "vitality":
                return [{
                    label: abbrev,
                    fullName: 'Hit Points',
                    description: 'Hit Points (affected by Vitality)',
                    tiering: this.getCombinedTiering(curVal, value => vitToHp(levelStats, jobStats, value)),
                }];
            case "determination":
                return [{
                    label: abbrev,
                    fullName: stat + ' multiplier',
                    description: 'Damage multiplier from Determination',
                    tiering: this.getCombinedTiering(curVal, value => detDmg(levelStats, value))
                }];
            case "piety":
                return [{
                    label: abbrev,
                    fullName: 'MP Regen',
                    description: 'MP Regen (affected by Piety)',
                    tiering: this.getCombinedTiering(curVal, value => mpTick(levelStats, value))
                }];
            case "crit":
                // return [{
                //     label: '%' + abbrev,
                //     fullName: 'critical strike chance',
                //     description: 'Chance to land a critical strike',
                //     tiering: this.getCombinedTiering(curVal, value => critChance(levelStats, value))
                // }, {
                //     label: 'x' + abbrev,
                //     fullName: 'critical hit multiplier',
                //     description: 'Damage multiplier when landing a critical hit',
                //     tiering: this.getCombinedTiering(curVal, value => critDmg(levelStats, value))
                // }];
                // Uncomment the above it crit chance and crit multi ever become decoupled in terms of tiering
                return [{
                    label: abbrev,
                    fullName: 'critical hit',
                    description: 'Critical hit (chance and multiplier)',
                    tiering: this.getCombinedTiering(curVal, value => critDmg(levelStats, value))
                }]
            case "dhit":
                return [{
                    label: abbrev,
                    fullName: 'direct hit change',
                    description: 'Change to land a direct hit',
                    tiering: this.getCombinedTiering(curVal, value => dhitChance(levelStats, value))
                }];
            case "spellspeed":
                return [{
                    label: abbrev + ' GCD',
                    fullName: 'GCD for spells',
                    description: 'Global cooldown (recast) time for spells',
                    tiering: this.getCombinedTiering(curVal, value => spsToGcd(2.5, levelStats, value))
                }, {
                    label: abbrev + ' DoT',
                    fullName: 'DoT scalar for spells',
                    description: 'DoT damage multiplier for spells',
                    tiering: this.getCombinedTiering(curVal, value => spsTickMulti(levelStats, value))
                }];
            case "skillspeed":
                return [{
                    label: abbrev + ' GCD',
                    fullName: 'GCD for weaponskills',
                    description: 'Global cooldown (recast) time for weaponskills',
                    tiering: this.getCombinedTiering(curVal, value => sksToGcd(2.5, levelStats, value))
                }, {
                    label: abbrev + ' DoT',
                    fullName: 'DoT scalar for weaponskills',
                    description: 'DoT damage multiplier for weaponskills',
                    tiering: this.getCombinedTiering(curVal, value => sksTickMulti(levelStats, value))
                }];
            case "tenacity":
                return [{
                    label: abbrev + ' Dmg',
                    fullName: stat + ' multiplier',
                    description: 'Damage multiplier from Tenacity',
                    tiering: this.getCombinedTiering(curVal, value => tenacityDmg(levelStats, value))
                }
                    // TODO: tenacity dmg reduc
                    // , {
                    //     label: abbrev + ' Def',
                    //     tiering: this.getCombinedTiering(curVal, value => tenacityDef(levelStats, value))
                    // }
                ];
            default:
                return [{
                    label: abbrev,
                    fullName: abbrev,
                    description: abbrev,
                    tiering: {
                        lower: 0,
                        upper: 0
                    }
                }]

        }
    }


    getCombinedTiering(currentValue: number, computation: ((statValue: number) => number)): Tiering {
        return {
            lower: this.getSingleTiering(false, currentValue, computation),
            upper: this.getSingleTiering(true, currentValue, computation),
        }
    }

    private getSingleTiering(upper: boolean, initialValue: number, computation: (statValue: number) => number) {
        const initialResult = computation(initialValue);
        for (let offset = 0; offset < 1000; offset++) {
            const testValue = upper ? (initialValue + offset) : (initialValue - (offset + 1));
            if (testValue <= 0) {
                return offset;
            }
            const newResult = computation(testValue);
            if (newResult !== initialResult) {
                return offset;
            }
        }
        throw new Error(`Tier computation error: upper: ${upper}; initialValue: ${initialValue}; initialResult: ${initialResult}`);
    }
}

customElements.define('stat-tiering-area', StatTierDisplay, {extends: 'div'});
customElements.define('single-stat-tier-display', SingleStatTierDisplay, {extends: 'div'});
