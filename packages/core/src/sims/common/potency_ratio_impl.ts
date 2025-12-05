import {CharacterGearSet} from "../../gear";
import {applyDhCrit, baseDamage} from "@xivgear/xivmath/xivmath";

export function potRatioImpl(set: CharacterGearSet) {
    const base = baseDamage(set.computedStats, 100, 'Spell');
    const final = applyDhCrit(base, set.computedStats);
    return {
        mainDpsResult: final,
        withoutCritDh: base,
    };

}
