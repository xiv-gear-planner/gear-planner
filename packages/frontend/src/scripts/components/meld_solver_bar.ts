import { makeActionButton } from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { MeldSolver } from "./meldsolver";
import { GearPlanSheetGui } from "./sheet";

export class MeldSolverBar extends HTMLDivElement {
    private _solver: MeldSolver;

    private textDiv: HTMLDivElement;

    constructor(sheet: GearPlanSheetGui) {
        super();

        //this.classList.add('meld-solver-area');
        this._solver = new MeldSolver(sheet);

        const button = makeActionButton("Solve Melds", async () => {
            const prommie = (async () => {

                return await this._solver.buttonPress();
            })();
            prommie.then(() => {
                this.textDiv.textContent = null;
            })
            this.textDiv.textContent = "Waiting...";
            return prommie;
        });
        
        this.textDiv = document.createElement('div');
        
        this.replaceChildren(button, this.textDiv);
    }


    public refresh(set: CharacterGearSet) {
        this._solver.refresh(set);
    }
}

customElements.define('meld-solver-area', MeldSolverBar, {extends: 'div'});