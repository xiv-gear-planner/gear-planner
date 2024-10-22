// import {AttackType, ComputedSetStats, JobData, LevelStats, PartyBonusAmount, RawStats} from "./geartypes";
// import {JobName, SupportedLevel} from "./xivconstants";
// import {critChance, sksToGcd, spsToGcd} from "./xivmath";
//
// // TODO: replace the interface with this type
// class ComputedSetStatsImpl implements ComputedSetStats {
//
//
//     readonly raw: RawStats;
//     readonly buffEffects = {
//         critChance: 0
//     };
//
//     constructor(
//         private readonly combinedStats: RawStats,
//         private readonly level: SupportedLevel,
//         private readonly levelStats: LevelStats,
//         private readonly classJob: JobName,
//         private readonly classJobStats: JobData,
//         private readonly partyBonus: PartyBonusAmount) {
//     }
//
//     gcdPhys(baseGcd: number, haste?: number): number {
//         return sksToGcd(baseGcd, this.levelStats, this.skillspeed, haste);
//     }
//
//     gcdMag(baseGcd: number, haste?: number): number {
//         return spsToGcd(baseGcd, this.levelStats, this.skillspeed, haste);
//     }
//
//     haste(attackType: AttackType): number {
//         // TODO
//         return 0;
//     }
//
//     get critChance() {
//         return critChance(this.levelStats, this.raw.crit + this.buffEffects.critChance);
//     }
//
//     get critChanceBonus() {
//         return this.buffEffects.critChance;
//     }
//
//     set critChanceBonus(value: number) {
//         this.buffEffects.critChance = value;
//     }
//
//     critMulti: number;
//     dhitChance: number;
//     dhitMulti: number;
//     detMulti: number;
//     spsDotMulti: number;
//     sksDotMulti: number;
//     tncMulti: number;
//     wdMulti: number;
//     mainStatMulti: number;
//     aaStatMulti: number;
//
//     traitMulti(attackType: "Unknown" | "Auto-attack" | "Spell" | "Weaponskill" | "Ability" | "Item"): number {
//         throw new Error("Method not implemented.");
//     }
//
//     autoDhBonus: number;
//     mpPerTick: number;
//     aaMulti: number;
//     aaDelay: number;
//     hp: number;
//     vitality: number;
//     strength: number;
//     dexterity: number;
//     intelligence: number;
//     mind: number;
//     piety: number;
//     crit: number;
//     dhit: number;
//     determination: number;
//     tenacity: number;
//     spellspeed: number;
//     skillspeed: number;
//     wdPhys: number;
//     wdMag: number;
//     weaponDelay: number;
//
//     get rawStats() {
//         return this.raw
//     }
//
//
// }
