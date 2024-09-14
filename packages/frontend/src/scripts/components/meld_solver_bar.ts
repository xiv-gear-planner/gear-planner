import { makeActionButton } from "@xivgear/common-ui/components/util";
import { CharacterGearSet } from "@xivgear/core/gear";
import { MeldSolver } from "@xivgear/core/meldsolver";
import { GearPlanSheet } from "@xivgear/core/sheet";

export class MeldSolverBar extends HTMLDivElement {
    private _solver: MeldSolver;

    private textDiv: HTMLDivElement;

    constructor(sheet: GearPlanSheet) {
        super();

        //this.classList.add('meld-solver-area');
        this._solver = new MeldSolver(sheet);

        const button = makeActionButton("Button", async () => {
            const prommie = (async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
                return await this._solver.buttonPress();
            })();
            prommie.then(result => this.textDiv.textContent = result.size.toString());
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