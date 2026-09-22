import {Materia, MateriaFillMode, MateriaSlot} from "@xivgear/xivmath/geartypes";
import {STAT_ABBREVIATIONS} from "@xivgear/xivmath/xivconstants";


export function isMateriaAllowed(materia: Materia, materiaSlot: MateriaSlot) {
    const highGradeAllowed = materiaSlot.allowsHighGrade;
    if (materia.isHighGrade && !highGradeAllowed) {
        return false;
    }
    if (materia.ilvl > materiaSlot.ilvl) {
        return false;
    }
    const maxGradeAllowed = materiaSlot.maxGrade;
    return materia.materiaGrade <= maxGradeAllowed;
}

export function materiaShortLabel(materia: Materia) {
    return `${materia.primaryStatValue} ${STAT_ABBREVIATIONS[materia.primaryStat]}`;
}

export const MATERIA_FILL_MODE_NAMES: Record<MateriaFillMode, string> = {
    "leave_empty": "Leave Empty",
    "autofill": "Prio Fill",
    "retain_slot_else_prio": "Keep Slot > Prio",
    "retain_item_else_prio": "Keep Item > Prio",
    "retain_slot": "Keep Slot > None",
    "retain_item": "Keep Item > None",
};

export function getMateriaFillModeName(mode: MateriaFillMode): string {
    return MATERIA_FILL_MODE_NAMES[mode] ?? "?";
}

