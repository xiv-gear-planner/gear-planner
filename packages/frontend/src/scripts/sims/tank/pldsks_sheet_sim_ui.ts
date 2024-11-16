import {FieldBoundCheckBox, labeledCheckbox, labelFor} from "@xivgear/common-ui/components/util";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";

import {PldSKSSheetSettings, PldSKSSheetSimResult} from "@xivgear/core/sims/tank/pld/pldsks_sim";

// Restoring the PLD SKS Sim settings UI, via the new SimGui class

export class pldSKSSimGui extends BaseMultiCycleSimGui<PldSKSSheetSimResult, PldSKSSheetSettings> {
    override makeCustomConfigInterface(settings: PldSKSSheetSettings, _updateCallback: () => void): HTMLElement | null {

        const outerDiv = document.createElement("div");
        const behaviorDiv = document.createElement("div");
        const openerDiv = document.createElement("div");
        const oddbinsDiv = document.createElement("div");

        const sksCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'acknowledgeSKS', {id: 'sks-checkbox'});
        const justMinimiseCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'justMinimiseDrift', {id: 'justmin-checkbox'});
        const tryCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'attempt9GCDAbove247', {id: 'try-checkbox'});
        const lateCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'alwaysLateWeave', {id: 'late-checkbox'});
        const avoidDoubleHS9sCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'avoidDoubleHS9s', {id: 'avoid2hs-checkbox'});
        const hyperRobotCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'useHyperRobotPrecision', {id: 'hyper-checkbox'});
        const neverGet9Check = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'simulateMissing9th', {id: 'neverget9-checkbox'});


        const hcOpenCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'hardcastopener', {id: 'hc-checkbox'});
        const earlyOpenCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'burstOneGCDEarlier', {id: 'early-checkbox'});
        const disableBurnCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'disableBurnDown', {id: 'burn-checkbox'});

        const disableNewPrioCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'perform12312OldPrio', {id: 'prio-checkbox'});
        const use701potenciesCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'use701potencies', {id: 'potency701-checkbox'});
        const hideCommentsCheck = new FieldBoundCheckBox<PldSKSSheetSettings>(settings, 'hideCommentText', {id: 'hidecomms-checkbox'});


        const opt1 = document.createElement("options1");
        const space1 = document.createElement("space1");
        const opt2 = document.createElement("options2");
        const space2 = document.createElement("space2");
        const opt3 = document.createElement("options3");
        const space3 = document.createElement("space3");

        behaviorDiv.appendChild(labeledCheckbox('Adjust Rotation for Skill Speed', sksCheck));
        behaviorDiv.appendChild(labelFor("Strategy Options:", opt1));
        behaviorDiv.appendChild(labeledCheckbox('Force just minimise drifting & 8s', justMinimiseCheck));
        behaviorDiv.appendChild(labeledCheckbox('Force trying for 9/8 at 2.47+', tryCheck));
        behaviorDiv.appendChild(labeledCheckbox('Force always late FOF at 2.43+', lateCheck));
        behaviorDiv.appendChild(labeledCheckbox('Avoid 2x & early HS in 9 GCD FOFs', avoidDoubleHS9sCheck));
        behaviorDiv.appendChild(labeledCheckbox('Assume perfect FOF late weaves', hyperRobotCheck));
        behaviorDiv.appendChild(labeledCheckbox('Simulate always missing 9th GCD', neverGet9Check));
        behaviorDiv.appendChild(labelFor("-", space1));

        openerDiv.appendChild(labelFor("Start & End:", opt2));
        openerDiv.appendChild(labeledCheckbox('Include a hardcast HS in the opener', hcOpenCheck));
        openerDiv.appendChild(labeledCheckbox('Use opener 1 GCD earlier', earlyOpenCheck));
        openerDiv.appendChild(labeledCheckbox('Disable 20s burn down optimisation', disableBurnCheck));
        openerDiv.appendChild(labelFor("-", space2));

        oddbinsDiv.appendChild(labelFor("Odd Options:", opt3));
        oddbinsDiv.appendChild(labeledCheckbox('What if? Use Endwalker 12312 Prio', disableNewPrioCheck));
        oddbinsDiv.appendChild(labeledCheckbox('Use Potencies from 7.01', use701potenciesCheck));
        oddbinsDiv.appendChild(labeledCheckbox('Hide All Extra Comments on Sheet', hideCommentsCheck));
        oddbinsDiv.appendChild(labelFor("-", space3));

        // Add our 3 sets of options:
        outerDiv.appendChild(behaviorDiv);
        outerDiv.appendChild(openerDiv);
        outerDiv.appendChild(oddbinsDiv);

        return outerDiv;
    }
}
