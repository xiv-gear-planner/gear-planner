import {CharacterGearSet} from "../gear";
import {GearPlanSheet} from "../components";
import {ALL_STATS, MAIN_STATS, STAT_ABBREVIATIONS, STAT_DISPLAY_ORDER} from "../xivconstants";
import {RawStatKey} from "../geartypes";
import {
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    mainStatMulti,
    mpTick,
    spsTickMulti,
    spsToGcd,
    tenacityDmg
} from "../xivmath";

interface Tiering {
    lower: number,
    upper: number
}

interface TieringDisplay {
    label: string,
    tiering: Tiering
}

export class SingleStatTierDisplay extends HTMLDivElement {
    constructor(stat: RawStatKey, tiering: TieringDisplay) {
        super();
        // Upper area - name of stat/derived value
        this.classList.add('single-stat-tier-display');
        this.classList.add('stat-' + stat);
        const upperDiv = document.createElement('div');
        upperDiv.textContent = tiering.label;
        upperDiv.classList.add('single-stat-tier-display-upper');
        this.appendChild(upperDiv);

        // Lower bound
        const lowerLeftDiv = document.createElement('div');
        if (tiering.tiering.lower > 0) {
            lowerLeftDiv.textContent = '-' + tiering.tiering.lower;
        }
        else {
            lowerLeftDiv.textContent = '✔';
            this.classList.add('stat-tiering-perfect');
        }
        lowerLeftDiv.classList.add('single-stat-tier-display-lower-left');
        this.appendChild(lowerLeftDiv);

        // Upper bound
        const lowerRightDiv = document.createElement('div');
        lowerRightDiv.textContent = '+' + tiering.tiering.upper;
        lowerRightDiv.classList.add('single-stat-tier-display-lower-right');
        this.appendChild(lowerRightDiv);
    }
}

export class StatTierDisplay extends HTMLDivElement {
    constructor(private sheet: GearPlanSheet) {
        super();
        this.classList.add('stat-tier-display');
    }

    refresh(gearSet: CharacterGearSet) {
        this.replaceChildren();
        const relevantStats = STAT_DISPLAY_ORDER.filter(stat => this.sheet.isStatRelevant(stat));
        for (let stat of relevantStats) {
            try {
                const statTiering = this.getStatTiering(stat, gearSet);
                for (let tieringDisplay of statTiering) {
                    this.appendChild(new SingleStatTierDisplay(stat, tieringDisplay));
                    // const tierDisplayNode = document.createElement('div');
                    // this.textContent += `${tieringDisplay.label}: -${tieringDisplay.tiering.lower} +${tieringDisplay.tiering.upper}; `;
                }
            } catch (e) {
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
                    tiering: this.getCombinedTiering(curVal, value => mainStatMulti(levelStats, jobStats, value))
                }];
            case "vitality":
                // Don't have vitality calc yet
                return [];
            // return [{
            //     label: STAT_ABBREVIATIONS[stat],
            //     tiering: this.getCombinedTiering(computed[stat], value => mainStatMulti(levelStats, jobStats, value))
            // }];
            case "determination":
                return [{
                    label: abbrev,
                    tiering: this.getCombinedTiering(curVal, value => detDmg(levelStats, value))
                }];
            case "piety":
                return [{
                    label: abbrev,
                    tiering: this.getCombinedTiering(curVal, value => mpTick(levelStats, value))
                }];
            case "crit":
                return [{
                    label: '%' + abbrev,
                    tiering: this.getCombinedTiering(curVal, value => critChance(levelStats, value))
                }, {
                    label: 'x' + abbrev,
                    tiering: this.getCombinedTiering(curVal, value => critDmg(levelStats, value))
                }];
            case "dhit":
                return [{
                    label: abbrev,
                    tiering: this.getCombinedTiering(curVal, value => dhitChance(levelStats, value))
                }];
            case "spellspeed":
                return [{
                    label: abbrev + ' GCD',
                    tiering: this.getCombinedTiering(curVal, value => spsToGcd(2.5, levelStats, value))
                }, {
                    label: abbrev + ' DoT',
                    tiering: this.getCombinedTiering(curVal, value => spsTickMulti(levelStats, value))
                }];
            case "skillspeed":
                return [{
                    label: abbrev + ' GCD',
                    tiering: this.getCombinedTiering(curVal, value => spsToGcd(2.5, levelStats, value))
                }, {
                    label: abbrev + ' DoT',
                    tiering: this.getCombinedTiering(curVal, value => spsTickMulti(levelStats, value))
                }];
            case "tenacity":
                return [{
                    label: abbrev + ' Dmg',
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
