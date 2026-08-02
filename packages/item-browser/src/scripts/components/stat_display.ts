import {ALL_SUB_STATS, MAIN_STATS, STAT_ABBREVIATIONS, statById} from "@xivgear/xivmath/xivconstants";
import {elt} from "@xivgear/common-ui/components/templates";
import {Mainstat, Substat} from "@xivgear/xivmath/geartypes";

/**
 * Displays an item BaseParam using the typical stat abbreviations.
 */
class StatDisplay extends HTMLElement {
    connectedCallback(): void {
        const baseParamId = Number(this.dataset.baseparamId);
        const amountAsString = this.dataset.baseparamAmount;
        const amount = Number(amountAsString);
        // isFinite filters out NaNs and such
        if (!Number.isFinite(baseParamId) || !Number.isFinite(amount)) {
            this.remove();
            return;
        }

        const stat = statById(baseParamId);
        const abbreviation = stat === undefined ? undefined : STAT_ABBREVIATIONS[stat];

        // We want a valid abbreviation
        if (abbreviation === undefined
            || stat === 'vitality') {
            this.remove();
            return;
        }
        // For now, just going to do substats, but can switch back to main stats easily.
        // if (!MAIN_STATS.includes(stat as Mainstat) && !ALL_SUB_STATS.includes(stat as Substat)) {
        if (!ALL_SUB_STATS.includes(stat as Substat)) {
            this.remove();
            return;
        }

        this.classList.add('stat-display', `stat-${stat}`);
        this.replaceChildren(
            elt('span', {class: 'stat-display-amount'})`${amount}`,
            elt('span', {class: 'stat-display-abbreviation'})`${abbreviation}`,
        );
    }
}

customElements.define('stat-display', StatDisplay);
