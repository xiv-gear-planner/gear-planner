import {GaugeManager} from "@xivgear/core/sims/cycle_sim";
import {BlmElement, BlmGaugeState, BlmAbility} from "./blm_types";
import {fl} from "@xivgear/xivmath/xivmath";

const damageUpModifiers = [1.4, 1.6, 1.8];
const damageDownModifiers = [0.9, 0.8, 0.7];

export class BlmGaugeManager implements GaugeManager<BlmGaugeState> {

    private _level: number;
    private _magicPoints: number = 10000;
    private _element: BlmElement = BlmElement.Unaspected;
    private _elementLevel: number = 0;
    private _firestarter: boolean = false;
    private _thunderhead: boolean = false;
    private _umbralHearts: number = 0;
    private _polyglot: number = 0;
    private _paradox: boolean = false;
    private _astralSoul: number = 0;

    constructor(level: number) {
        this._level = level;
    }

    get level(): number {
        return this._level;
    }

    get magicPoints(): number {
        return this._magicPoints;
    }

    get element(): BlmElement {
        return this._element;
    }

    get elementLevel(): number {
        return this._elementLevel;
    }

    get firestarter(): boolean {
        return this._firestarter;
    }

    get thunderhead(): boolean {
        return this._thunderhead;
    }

    get umbralHearts(): number {
        return this._umbralHearts;
    }

    get polyglot(): number {
        return this._polyglot;
    }

    get paradox(): boolean {
        return this._paradox;
    }

    get astralSoul(): number {
        return this._astralSoul;
    }

    set magicPoints(newGauge: number) {
        if (newGauge > 10000) {
            // No need to log this actually.
            //console.log(`[BLM Sim] Overcapped MP by ${newGauge - 10000}. (This is probably not a problem)`);
        }
        if (newGauge < 0) {
            console.warn(`[BLM Sim] Used ${this._magicPoints - newGauge} MP when you only have ${this._magicPoints}.`);
        }
        this._magicPoints = Math.max(Math.min(newGauge, 10000), 0);
    }

    set element(newElement: BlmElement) {
        this._element = newElement;
    }

    set elementLevel(newElementLevel: number) {
        this._elementLevel = newElementLevel;
    }

    set firestarter(newFirestarter: boolean) {
        if (this._firestarter && newFirestarter) {
            console.warn(`[BLM Sim] Overwrote Firestarter. (This may be intended)`);
        }
        this._firestarter = newFirestarter;
    }

    set thunderhead(newThunderhead: boolean) {
        this._thunderhead = newThunderhead;
    }

    set umbralHearts(newUmbralHearts: number) {
        this._umbralHearts = Math.max(Math.min(newUmbralHearts, 3), 0);
    }

    set polyglot(newPolyglot: number) {
        // Levels for polyglot charges
        if (newPolyglot > this.getMaxPolyglotCharges()) {
            console.warn(`[BLM Sim] Overcapped Polyglot by ${newPolyglot - this.getMaxPolyglotCharges()}.`);
        }
        if (newPolyglot < 0) {
            console.warn(`[BLM Sim] Used ${this._polyglot - newPolyglot} Polyglot when you only have ${this._polyglot}.`);
        }
        this._polyglot = Math.max(Math.min(newPolyglot, 3), 0);
    }

    set paradox(newParadox: boolean) {
        // If below level 90, just don't.
        if (this.level < 90) return;

        if (this._paradox && newParadox) {
            console.warn("[BLM Sim] Overwrote Paradox.");
        }
        this._paradox = newParadox;
    }

    set astralSoul(newAstralSoul: number) {
        // If below level 100, just don't.
        if (this.level < 100) return;

        if (newAstralSoul > 6) {
            console.warn(`[BLM Sim] Overcapped Astral Soul by ${newAstralSoul - 6}.`);
        }
        if (newAstralSoul < 0) {
            console.warn(`[BLM Sim] Used ${this._astralSoul - newAstralSoul} Astral Soul when you only have ${this._astralSoul}.`);
        }
        this._astralSoul = Math.max(Math.min(newAstralSoul, 6), 0);
    }

    getMaxPolyglotCharges(): number {
        if (this.level >= 98) {
            return 3;
        }
        else if (this.level >= 80) {
            return 2;
        }
        else {
            return 1;
        }
    }

    getEnochianModifier(): number {
        if (this.level >= 96) {
            return 1.27;
        }
        else if (this.level >= 86) {
            return 1.22;
        }
        else if (this.level >= 78) {
            return 1.15;
        }
        else {
            return 1.10;
        }
    }

    isIn(element: BlmElement, level: number = 1): boolean {
        return this.element === element && this.elementLevel >= level;
    }

    isInFire(level: number = 1): boolean {
        return this.isIn(BlmElement.Fire, level);
    }

    isInIce(level: number = 1): boolean {
        return this.isIn(BlmElement.Ice, level);
    }

    giveAstralFire(level: number) {
        // Entering from no element or from UI gives Thunderhead.
        if (!this.isInFire()) {
            this.thunderhead = true;
        }
        // Switching from UI3 gives Paradox.
        if (this.isInIce(3)) {
            this.paradox = true;
        }
        this.element = BlmElement.Fire;
        this.elementLevel = level;
    }

    giveUmbralIce(level: number) {
        // Entering from no element or from UI gives Thunderhead.
        if (!this.isInIce()) {
            this.thunderhead = true;
        }
        // Switching from AF3 gives Paradox.
        if (this.isInFire(3)) {
            this.paradox = true;
        }
        // Switching from any level of AF removes all stacks of Astral Soul.
        if (this.isInFire()) {
            this.astralSoul = 0;
        }
        this.element = BlmElement.Ice;
        this.elementLevel = level;
    }

    // Gets Fire/Ice spells with potency/cast time/MP cost adjusted for the current element.
    getAdjustedAbility(ability: BlmAbility): BlmAbility {
        const mods = {
            potency: ability.potency,
            cast: ability.cast ?? 0,
        };
        if (ability.element === BlmElement.Fire) {
            mods.potency *= this._getFirePotencyMulti();
            mods.cast *= this._getFireCastMulti();
        }
        else if (ability.element === BlmElement.Ice) {
            mods.potency *= this._getIcePotencyMulti();
            mods.cast *= this._getIceCastMulti();
        }
        // Enochian damage buff if Fire/Ice active.
        if (this.element !== BlmElement.Unaspected) {
            if (this.level >= 96) {
                mods.potency *= 1.27;
            }
            else if (this.level >= 86) {
                mods.potency *= 1.22;
            }
            else if (this.level >= 78) {
                mods.potency *= 1.15;
            }
            else if (this.level >= 70) {
                mods.potency *= 1.10;
            }
        }
        return {...ability, ...mods};
    }

    private _getFirePotencyMulti(): number {
        if (this.isInFire()) {
            return damageUpModifiers[this.elementLevel - 1];
        }
        else if (this.isInIce()) {
            return damageDownModifiers[this.elementLevel - 1];
        }
        else {
            return 1;
        }
    }

    private _getIcePotencyMulti(): number {
        if (this.isInFire()) {
            return damageDownModifiers[this.elementLevel - 1];
        }
        else {
            return 1;
        }
    }

    private _getFireCastMulti(): number {
        if (this.isInIce(3)) {
            return 0.5;
        }
        return 1;
    }

    private _getIceCastMulti(): number {
        if (this.isInFire(3)) {
            return 0.5;
        }
        return 1;
    }

    getIceMpGain(): number {
        if (this.isInIce(1)) {
            return 2500;
        }
        else if (this.isInIce(2)) {
            return 5000;
        }
        else if (this.isInIce(3)) {
            return 10000;
        }
        else {
            return 0;
        }
    }

    canUseFireSpell(mpCost: number | 'flare' | 'despair'): boolean {
        if (this.isInIce()) {
            return true;
        }
        if (mpCost === 'flare' || mpCost === 'despair') {
            // 800 MP minimum to be able to cast Flare or Despair.
            return this.magicPoints >= 800;
        }
        if (this.isInFire() && this.umbralHearts === 0) {
            // Doubled MP cost when in Astral Fire without Umbral Hearts.
            return this.magicPoints >= (2 * mpCost);
        }
        return this.magicPoints >= mpCost;
    }

    updateForFireSpell(mpCost: number | 'flare' | 'despair') {
        // Fire spells cost no MP in Umbral Ice. (those that you can even cast from UI.)
        if (this.isInIce()) {
            return;
        }

        if (mpCost === 'flare') {
            if (this.umbralHearts > 0) {
                // Flare removes all Umbral Hearts and reduces MP cost by one third.
                this.umbralHearts = 0;
                this.magicPoints -= 2 * fl(this.magicPoints / 3);
            }
            else {
                // Otherwise it just consumes all MP.
                this.magicPoints = 0;
            }
        }
        else if (mpCost === 'despair') {
            // Despair just does not consume Umbral Hearts and consumes all MP.
            this.magicPoints = 0;
        }
        else {
            if (!this.isInFire()) {
                // If neither in Fire or Ice, MP cost is just normal.
                this.magicPoints -= mpCost;
            }
            else if (this.umbralHearts > 0) {
                // If you have an Umbral Heart, it is consumed to negate the increased MP cost.
                this.umbralHearts -= 1;
                this.magicPoints -= mpCost;
            }
            else {
                // Otherwise, the cost is doubled.
                this.magicPoints -= 2 * mpCost;
            }
        }
    }

    canUseIceSpell(mpCost: number): boolean {
        // Ice spells only cost MP if cast with no element.
        if (this.element === BlmElement.Unaspected) {
            return this.magicPoints >= mpCost;
        }
        return true;
    }

    updateForIceSpell(mpCost: number) {
        // Ice spells only cost MP if cast with no element.
        if (this.element === BlmElement.Unaspected) {
            this.magicPoints -= mpCost;
        }
        // Casting an ice spell in Umbral Ice restores MP depending on the level of UI.
        if (this.isInIce()) {
            if (this.elementLevel === 1) {
                this.magicPoints += 2500;
            }
            else if (this.elementLevel === 2) {
                this.magicPoints += 5000;
            }
            else if (this.elementLevel === 3) {
                this.magicPoints += 10000;
            }
        }
    }

    gaugeSnapshot(): BlmGaugeState {
        return {
            level: this.level,
            element: this.element,
            elementLevel: this.elementLevel,
            magicPoints: this.magicPoints,
            umbralHearts: this.umbralHearts,
            polyglot: this.polyglot,
            paradox: this.paradox,
            astralSoul: this.astralSoul,
        };
    }
}
