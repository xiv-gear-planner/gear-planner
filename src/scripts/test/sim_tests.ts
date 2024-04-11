import {it} from "mocha";
import * as assert from "assert";
import {BaseMultiCycleSim, ExternalCycleSettings, Rotation} from "../sims/sim_processors";
import {SimSpec, Simulation} from "../simulation";

class TestMultiCycleSim extends BaseMultiCycleSim<any, any> {
    displayName: string;

    getRotationsToSimulate(): Rotation[] {
        return [];
    }

    makeDefaultSettings(): any {
    }

    shortName: string;
    spec: SimSpec<Simulation<any, any, ExternalCycleSettings<any>>, ExternalCycleSettings<any>>;

}

describe('cycle sim processor tests', () => {
    it('produces the correct results', () => {

    });
});