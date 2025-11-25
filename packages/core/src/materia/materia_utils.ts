import {Materia, MateriaSlot} from "@xivgear/xivmath/geartypes";
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

