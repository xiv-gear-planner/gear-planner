import {DataSelect, FieldBoundDataSelect} from "./util";
import {CURRENT_MAX_LEVEL, SupportedLevel, SupportedLevels} from "@xivgear/xivmath/xivconstants";
import {PropertyOfType} from "@xivgear/util/util_types";

export function levelLabel(item: SupportedLevel): string {
    if (item <= CURRENT_MAX_LEVEL) {
        return item.toString();
    }
    else {
        return item.toString() + ' (Preview)';
    }
}

export function fieldBoundLevelSelect<ObjType>(obj: ObjType, field: PropertyOfType<ObjType, SupportedLevel>): FieldBoundDataSelect<ObjType, SupportedLevel> {
    return new FieldBoundDataSelect(obj, field, levelLabel, [...SupportedLevels]);
}

export function levelSelect(callback: (level: SupportedLevel) => void, defaultLevel: SupportedLevel = CURRENT_MAX_LEVEL): DataSelect<SupportedLevel> {
    return new DataSelect<SupportedLevel>([...SupportedLevels], levelLabel, callback, defaultLevel);
}
