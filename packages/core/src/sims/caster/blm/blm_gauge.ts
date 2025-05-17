import {BlmGaugeState} from "./blm_types";

const damageUpModifiers = [1.4, 1.6, 1.8];
const damageDownModifiers = [0.9, 0.8, 0.7];

export class BlmGauge {

    private _aspect: number = 0;
    private _umbralHearts: number = 0;
    private _magicPoints: number = 10000;
    private _polyglot: number = 0;
    private _paradox: boolean = false;
    private _astralSoul: number = 0;

    get aspect(): number {
        return this._aspect;
    }

    get umbralHearts(): number {
        return this._umbralHearts;
    }

    get magicPoints(): number {
        return this._magicPoints;
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

    set aspect(newAspect: number) {
        this._aspect = Math.max(Math.min(newAspect, 3), -3);
    }

    set umbralHearts(newUmbralHearts: number) {
        this._umbralHearts = Math.max(Math.min(newUmbralHearts, 3), 0);
    }

    set magicPoints(newGauge: number) {
        if (newGauge > 10000) {
            console.warn(`[BLM Sim] Overcapped MP by ${newGauge - 10000}.`);
        }
        if (newGauge < 0) {
            console.warn(`[BLM Sim] Used ${this._magicPoints - newGauge} MP when you only have ${this._magicPoints}.`);
        }
        this._magicPoints = Math.max(Math.min(newGauge, 10000), 0);
    }

    set polyglot(newPolyglot: number) {
        if (newPolyglot > 3) {
            console.warn(`[BLM Sim] Overcapped Polyglot by ${newPolyglot - 3}.`);
        }
        if (newPolyglot < 0) {
            console.warn(`[BLM Sim] Used ${this._polyglot - newPolyglot} Polyglot when you only have ${this._polyglot}.`);
        }
        this._polyglot = Math.max(Math.min(newPolyglot, 3), 0);
    }

    set paradox(newParadox: boolean) {
        if (this._paradox && newParadox) {
            console.warn("[BLM Sim] Overwrote Paradox.");
        }
        this._paradox = newParadox;
    }

    set astralSoul(newAstralSoul: number) {
        if (newAstralSoul > 6) {
            console.warn(`[BLM Sim] Overcapped Astral Soul by ${newAstralSoul - 6}.`);
        }
        if (newAstralSoul < 0) {
            console.warn(`[BLM Sim] Used ${this._astralSoul - newAstralSoul} Astral Soul when you only have ${this._astralSoul}.`);
        }
        this._astralSoul = Math.max(Math.min(newAstralSoul, 6), 0);
    }

    giveAstralFire(level: number) {
        // Switching from UI3 gives Paradox.
        if (this.aspect === -3) {
            this.paradox = true;
        }
        this.aspect = level;
    }

    giveUmbralIce(level: number) {
        // Switching from AF3 gives Paradox.
        if (this.aspect === +3) {
            this.paradox = true;
        }
        // Switching from any level of AF removes all stacks of Astral Soul.
        if (this.aspect > 0) {
            this.astralSoul = 0;
        }
        this.aspect = -level;
    }

    getFireMpMulti(): number {
        // Fire spells cost no MP in umbral ice.
        if (this.aspect < 0) {
            return 0;
        }
        // Only increased MP cost if AF3 and no umbral hearts.
        if (this.aspect === +3 && this.umbralHearts === 0) {
            return 2;
        }
        return 1;
    }

    getIceMpMulti(): number {
        // Ice spells only cost MP with no element at all.
        if (this.aspect !== 0) {
            return 0;
        }
        return 1;
    }

    getFirePotencyMulti(): number {
        if (this.aspect > 0) {
            return damageUpModifiers[this.aspect - 1];
        }
        else if (this.aspect < 0) {
            return damageDownModifiers[-this.aspect - 1];
        }
        else {
            return 1;
        }
    }

    getIcePotencyMulti(): number {
        if (this.aspect > 0) {
            return damageDownModifiers[this.aspect - 1];
        }
        else {
            return 1;
        }
    }

    getFireCastMulti(): number {
        if (this.aspect === -3) {
            return 0.5;
        }
        return 1;
    }

    getIceCastMulti(): number {
        if (this.aspect === +3) {
            return 0.5;
        }
        return 1;
    }

    getIceMpGain(): number {
        if (this.aspect === -1) {
            return 2500;
        }
        else if (this.aspect === -2) {
            return 5000;
        }
        else if (this.aspect === -3) {
            return 10000;
        }
        else {
            return 0;
        }
    }

    getGaugeState(): BlmGaugeState {
        return {
            aspect: this.aspect,
            umbralHearts: this.umbralHearts,
            mp: this.magicPoints,
            polyglot: this.polyglot,
            paradox: this.paradox,
            astralSoul: this.astralSoul,
        };
    }
}
