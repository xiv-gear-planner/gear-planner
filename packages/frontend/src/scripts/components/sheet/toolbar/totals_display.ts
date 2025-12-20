import {CharacterGearSet} from "@xivgear/core/gear";
import {ChanceStat, GcdStat, MultiplierMitStat, MultiplierStat, RawStatKey, TickStat} from "@xivgear/xivmath/geartypes";
import {NORMAL_GCD, STAT_ABBREVIATIONS, STAT_DISPLAY_ORDER} from "@xivgear/xivmath/xivconstants";
import {toRelPct} from "@xivgear/util/strutils";

export class SetViewToolbar extends HTMLElement {

    private readonly totalsDisplay: SetTotalsDisplay;

    constructor(gearSet: CharacterGearSet) {
        super();
        this.totalsDisplay = new SetTotalsDisplay(gearSet);
        this.appendChild(this.totalsDisplay);
    }

    refresh(gearSet: CharacterGearSet) {
        this.totalsDisplay.refresh(gearSet);
    }

}

type StatDisplayType = ConstructorParameters<typeof SingleStatTotalDisplay>[1];

export class SetTotalsDisplay extends HTMLElement {

    constructor(gearSet: CharacterGearSet) {
        super();
        this.refresh(gearSet);
    }

    refresh(gearSet: CharacterGearSet): void {
        this.replaceChildren();
        const stats = gearSet.computedStats;
        const relevantStats = STAT_DISPLAY_ORDER.filter(stat => gearSet.isStatRelevant(stat));
        for (const stat of relevantStats) {
            try {
                let value: Omit<StatDisplayType, 'stat'>;
                switch (stat) {
                    case "strength":
                    case "dexterity":
                    case "intelligence":
                    case "mind":
                        value = {multiplier: stats.mainStatMulti};
                        break;
                    case "determination":
                        value = {multiplier: stats.detMulti};
                        break;
                    case "tenacity":
                        value = {
                            multiplier: stats.tncMulti,
                            incomingMulti: stats.tncIncomingMulti,
                        };
                        break;
                    case "piety":
                        value = {perTick: stats.mpPerTick};
                        break;
                    case "crit":
                        value = {
                            chance: stats.critChance,
                            multiplier: stats.critMulti,
                        };
                        break;
                    case "dhit":
                        value = {
                            chance: stats.dhitChance,
                            multiplier: stats.dhitMulti,
                        };
                        break;
                    case "spellspeed":
                        value = {
                            gcd: stats.gcdMag(NORMAL_GCD),
                            multiplier: stats.spsDotMulti,
                        };
                        break;
                    case "skillspeed":
                        value = {
                            gcd: stats.gcdPhys(NORMAL_GCD),
                            multiplier: stats.sksDotMulti,
                        };
                        break;
                }
                if (value) {
                    this.appendChild(new SingleStatTotalDisplay(stat, {
                        stat: stats[stat],
                        ...value,
                    } as StatDisplayType));
                }
            }
            catch (e) {
                console.error("Error computing stat totals", e);
            }
        }
    }
}

export class SingleStatTotalDisplay extends HTMLDivElement {
    /**
     * Construct a widget for displaying the resulting values of a single stat
     *
     * @param stat The stat
     * @param value Either one or two strings. One string will display centered, two will display with the first
     * on the left, and the second on the right.
     */
    constructor(stat: RawStatKey, value: MultiplierStat | ChanceStat | TickStat | GcdStat | MultiplierMitStat) {
        super();
        // Upper area - name of stat/derived value
        this.classList.add('stat-total');
        this.classList.add('stat-' + stat);
        const upperDiv = document.createElement('div');
        upperDiv.textContent = STAT_ABBREVIATIONS[stat];
        upperDiv.classList.add('stat-total-upper');
        this.appendChild(upperDiv);

        const middleDiv = document.createElement('div');
        middleDiv.textContent = value.stat.toString();
        middleDiv.classList.add('stat-total-middle');
        this.appendChild(middleDiv);

        if ('multiplier' in value) {
            if ('chance' in value) {
                this.appendChild(quickTextDiv('stat-total-lower-left', `${(value.chance * 100.0).toFixed(1)}%`));
                this.appendChild(quickTextDiv('stat-total-lower-right', `x${value.multiplier.toFixed(3)}`));
                this.classList.add('stat-total-wide');
            }
            else if ('gcd' in value) {
                this.appendChild(quickTextDiv('stat-total-lower-left', value.gcd.toString()));
                this.appendChild(quickTextDiv('stat-total-lower-right', `x${value.multiplier.toFixed(3)}`));
                this.classList.add('stat-total-wide');
            }
            else if ('incomingMulti' in value) {
                this.appendChild(quickTextDiv('stat-total-lower-left', value.multiplier.toString() + ','));
                this.appendChild(quickTextDiv('stat-total-lower-right', `${toRelPct(value.incomingMulti - 1, 1)}%`));
                this.classList.add('stat-total-wide');
            }
            else {
                this.appendChild(quickTextDiv('stat-total-lower-center', `x${value.multiplier.toFixed(3)}`));
                this.classList.add('stat-total-narrow');
            }
        }
        else {
            this.appendChild(quickTextDiv('stat-total-lower-center', `+${value.perTick.toFixed(0)}/tick`));
            this.classList.add('stat-total-narrow');
        }
    }
}

function quickTextDiv(cls: string, content: string) {
    const div = document.createElement('div');
    div.classList.add(cls);
    div.textContent = content;
    return div;
}

customElements.define('set-view-toolbar', SetViewToolbar);
customElements.define('set-totals-display', SetTotalsDisplay);
customElements.define('stat-total', SingleStatTotalDisplay, {extends: 'div'});
