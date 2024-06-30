import {Divination} from "@xivgear/core/sims/buffs";
import {GcdAbility, OgcdAbility, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, Rotation} from "@xivgear/core/sims/cycle_sim";
import {BaseMultiCycleSim} from "../sim_processors";
import {BuffSettingsExport} from "@xivgear/core/sims/common/party_comp_settings";


const filler: GcdAbility = {
    id: 25871,
    type: 'gcd',
    name: "Fall Malefic",
    potency: 270,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5
};

const combust: GcdAbility = {
    id: 16554,
    type: 'gcd',
    name: "Combust III",
    potency: 0,
    dot: {
        id: 2041,
        tickPotency: 70,
        duration: 30
    },
    attackType: "Spell",
    gcd: 2.5,
};

const star: OgcdAbility = {
    id: 7439,
    type: 'ogcd',
    name: "Earthly Star",
    potency: 310,
    attackType: "Ability"
};

const lord: OgcdAbility = {
    id: 7444,
    type: 'ogcd',
    name: "Lord of Crowns",
    potency: 400,
    attackType: "Ability"
};

const div: OgcdAbility = {
    type: 'ogcd',
    name: "Divination",
    id: 16552,
    activatesBuffs: [Divination],
    potency: null,
    attackType: "Ability",
    cooldown: {
        time: 120
    }
};

/*const astrodyne: OgcdAbility = {
    id: 25870,
    name: "Astrodyne",
    type: "ogcd",
    potency: null,
    activatesBuffs: [
        {
            name: "Astrodyne",
            selfOnly: true,
            duration: 15,
            effects: { //currently assumes 2 seal dynes, can change dmgIncrease based on frequency of 3 seals
                // dmgIncrease: 0.00,
                haste: 10,
            },
        }
    ],
    attackType: "Ability",
};*/

const psyche: OgcdAbility = {
    type: 'ogcd',
    name: "Oracle",
    id: 37029,
    potency: 860,
    attackType: "Ability"
};

export interface AstSheetSimResult extends CycleSimResult {
}

export interface AstNewSheetSettings extends SimSettings {
    rezPerMin: number,
    aspHelPerMin: number,
    aspBenPerMin: number,

}

export interface AstNewSheetSettingsExternal extends ExternalCycleSettings<AstNewSheetSettings> {
    buffConfig: BuffSettingsExport;
}

export const astNewSheetSpec: SimSpec<AstSheetSim, AstNewSheetSettingsExternal> = {
    displayName: "AST Sim",
    loadSavedSimInstance(exported: AstNewSheetSettingsExternal) {
        return new AstSheetSim(exported);
    },
    makeNewSimInstance(): AstSheetSim {
        return new AstSheetSim();
    },
    stub: "ast-sheet-sim",
    supportedJobs: ['AST'],
    isDefaultSim: true
};

export class AstSheetSim extends BaseMultiCycleSim<AstSheetSimResult, AstNewSheetSettings> {

    makeDefaultSettings(): AstNewSheetSettings {
        return {
            rezPerMin: 0,
            aspHelPerMin: 0,
            aspBenPerMin: 0,
        }
    };

    spec = astNewSheetSpec;
    displayName = astNewSheetSpec.displayName;
    shortName = "ast-sheet-sim";
    manuallyActivatedBuffs = [Divination];

    constructor(settings?: AstNewSheetSettingsExternal) {
        super('AST', settings);
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                cp.use(filler);
                cp.remainingCycles(cycle => {
                    cycle.use(combust); 
                    cycle.use(filler); //lightspeed
                    cycle.use(filler); //div, balance
                    cycle.use(div);
                    cycle.use(filler); //lord, draw
                    cycle.use(lord);
                    cycle.use(filler); //spear, oracle
                    cycle.use(oracle);
                    cycle.use(filler);
                    cycle.use(star);
                    cycle.useUntil(filler, 30);
                    cycle.use(combust);
                    cycle.useUntil(filler, 60);
                    cycle.use(combust);
                    cycle.useUntil(filler, 75);
                    cycle.use(star);
                    cycle.useUntil(filler, 90);
                    cycle.use(combust);
                    cycle.useUntil(filler, 'end');
                })
            }
        }];
    }


}
