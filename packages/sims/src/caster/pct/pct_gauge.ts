import {GaugeManager} from "@xivgear/sims/cycle_sim";
import {CREATURE_MOTIFS, PctCreatureMotif, PctGaugeState, PctPortrait} from "./pct_types";
import {MAX_PAINT, MAX_PALETTE, SUBTRACTIVE_PALETTE_COST} from "./pct_consts";

/**
 * Tracks the Pictomancer gauges: the Palette gauge, paint (white/black), and the three canvases.
 */
export class PctGaugeManager implements GaugeManager<PctGaugeState> {

    private readonly _level: number;
    private _palette: number = 0;
    private _paint: number = 0;
    private _monochrome: boolean = false;
    private _creatureCanvas: PctCreatureMotif | null = null;
    private _nextCreatureIndex: number = 0;
    private _portrait: PctPortrait | null = null;
    private _hammerCanvas: boolean = false;
    private _starryCanvas: boolean = false;

    constructor(level: number) {
        this._level = level;
    }

    get level(): number {
        return this._level;
    }

    get palette(): number {
        return this._palette;
    }

    set palette(newPalette: number) {
        if (newPalette > MAX_PALETTE) {
            console.warn(`[PCT Sim] Overcapped Palette gauge by ${newPalette - MAX_PALETTE}.`);
        }
        if (newPalette < 0) {
            console.error(`[PCT Sim] Used ${this._palette - newPalette} Palette when only ${this._palette} was available.`);
        }
        this._palette = Math.max(Math.min(newPalette, MAX_PALETTE), 0);
    }

    get paint(): number {
        return this._paint;
    }

    set paint(newPaint: number) {
        if (newPaint > MAX_PAINT) {
            console.warn(`[PCT Sim] Overcapped paint by ${newPaint - MAX_PAINT}.`);
        }
        if (newPaint < 0) {
            console.error(`[PCT Sim] Used paint with no charges available.`);
        }
        this._paint = Math.max(Math.min(newPaint, MAX_PAINT), 0);
    }

    /**
     * Whether Monochrome Tones is active (black paint is held, or the next paint will become black).
     */
    get monochrome(): boolean {
        return this._monochrome;
    }

    set monochrome(value: boolean) {
        if (value && this._monochrome) {
            console.warn(`[PCT Sim] Monochrome Tones was already active, black paint wasted.`);
        }
        this._monochrome = value;
    }

    /**
     * Whether Comet in Black can be used, i.e. black paint is currently held.
     */
    get hasBlackPaint(): boolean {
        return this._monochrome && this._paint > 0;
    }

    /**
     * Whether Holy in White can be used, i.e. white paint is held and black paint is not.
     */
    get hasWhitePaint(): boolean {
        return !this._monochrome && this._paint > 0;
    }

    get creatureCanvas(): PctCreatureMotif | null {
        return this._creatureCanvas;
    }

    get nextCreature(): PctCreatureMotif {
        return CREATURE_MOTIFS[this._nextCreatureIndex];
    }

    get portrait(): PctPortrait | null {
        return this._portrait;
    }

    get hammerCanvas(): boolean {
        return this._hammerCanvas;
    }

    set hammerCanvas(value: boolean) {
        this._hammerCanvas = value;
    }

    get starryCanvas(): boolean {
        return this._starryCanvas;
    }

    set starryCanvas(value: boolean) {
        this._starryCanvas = value;
    }

    /**
     * Spend 50 palette on Subtractive Palette.
     *
     * @param grantMonochrome Whether Monochrome Tones is granted (Enhanced Palette, level 90).
     */
    useSubtractivePalette(grantMonochrome: boolean): void {
        this.palette -= SUBTRACTIVE_PALETTE_COST;
        if (grantMonochrome) {
            this.monochrome = true;
        }
    }

    /**
     * Subtractive Palette without the palette cost (under Subtractive Spectrum).
     *
     * @param grantMonochrome Whether Monochrome Tones is granted (Enhanced Palette, level 90).
     */
    useFreeSubtractivePalette(grantMonochrome: boolean): void {
        if (grantMonochrome) {
            this.monochrome = true;
        }
    }

    /**
     * Spend a paint charge on Comet in Black.
     */
    useBlackPaint(): void {
        if (!this.hasBlackPaint) {
            console.error(`[PCT Sim] Used Comet in Black without black paint.`);
        }
        this.paint -= 1;
        this._monochrome = false;
    }

    /**
     * Spend a paint charge on Holy in White.
     */
    useWhitePaint(): void {
        if (!this.hasWhitePaint) {
            console.error(`[PCT Sim] Used Holy in White without white paint.`);
        }
        this.paint -= 1;
    }

    /**
     * Paint a creature motif onto the canvas.
     *
     * @param motif The motif being painted. Must be the next motif in the Pom > Wing > Claw > Maw sequence.
     */
    paintCreatureMotif(motif: PctCreatureMotif): void {
        if (motif !== this.nextCreature) {
            console.warn(`[PCT Sim] Painted ${motif} motif, but the next motif should have been ${this.nextCreature}.`);
        }
        if (this._creatureCanvas !== null) {
            console.warn(`[PCT Sim] Painted ${motif} motif over an existing ${this._creatureCanvas} motif.`);
        }
        this._creatureCanvas = motif;
    }

    /**
     * Use a Living Muse, consuming the creature canvas and advancing the creature sequence. Wing and Maw also
     * produce the Mog and Madeen portraits respectively.
     */
    useCreatureMuse(): void {
        const motif = this._creatureCanvas;
        if (motif === null) {
            console.error(`[PCT Sim] Used a Living Muse without a creature motif painted.`);
            return;
        }
        if (motif === 'wing' || motif === 'maw') {
            const newPortrait: PctPortrait = motif === 'wing' ? 'mog' : 'madeen';
            if (this._portrait !== null) {
                console.warn(`[PCT Sim] Overwrote an unused ${this._portrait} portrait with ${newPortrait}.`);
            }
            this._portrait = newPortrait;
        }
        this._creatureCanvas = null;
        this._nextCreatureIndex = (CREATURE_MOTIFS.indexOf(motif) + 1) % CREATURE_MOTIFS.length;
    }

    /**
     * Use the available portrait (Mog of the Ages / Retribution of the Madeen).
     */
    usePortrait(): void {
        if (this._portrait === null) {
            console.error(`[PCT Sim] Used a portrait without one available.`);
        }
        this._portrait = null;
    }

    gaugeSnapshot(): PctGaugeState {
        return {
            level: this.level,
            palette: this.palette,
            paint: this.paint,
            monochrome: this.monochrome,
            creatureCanvas: this.creatureCanvas,
            nextCreature: this.nextCreature,
            portrait: this.portrait,
            hammerCanvas: this.hammerCanvas,
            starryCanvas: this.starryCanvas,
        };
    }
}
