/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: get back to fixing this at some point
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {
    col,
    CustomRow,
    CustomTable,
    SingleRowSelectionModel,
    TableSelectionModel
} from "@xivgear/common-ui/table/tables";
import {SimSpec} from "@xivgear/core/sims/sim_types";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {JobIcon} from "../job/job_icon";
import {FieldBoundCheckBox, labeledCheckbox, makeActionButton, quickElement} from "@xivgear/common-ui/components/util";
import {simMaintainersInfoElement} from "./sims";
import {getRegisteredSimSpecs} from "@xivgear/core/sims/sim_registry";

export class AddSimDialog extends BaseModal {
    private readonly table: CustomTable<SimSpec<any, any>, TableSelectionModel<SimSpec<any, any>>>;
    private _showAllSims: boolean = false;

    constructor(private sheet: GearPlanSheet) {
        super();
        this.id = 'add-sim-dialog';
        this.headerText = 'Add Simulation';
        const form = document.createElement("form");
        form.method = 'dialog';
        this.table = new CustomTable();
        const selModel = new SingleRowSelectionModel<SimSpec<any, any>>();
        this.table.selectionModel = selModel;
        this.table.classList.add('hoverable');
        this.table.columns = [
            col({
                shortName: 'sim-job-icon',
                displayName: 'Icon',
                // fixedWidth: 500,
                getter: item => item.supportedJobs,
                renderer: (value) => {
                    if (!value) {
                        return document.createTextNode('');
                    }
                    if (value.length === 1) {
                        return new JobIcon(value[0]);
                    }
                    // TODO: use role icon for sims that support entire roles
                    // Role icons start at 062581
                    return document.createTextNode('');
                },
            }),
            col({
                shortName: 'sim-name',
                displayName: 'Name',
                // fixedWidth: 500,
                getter: item => item.displayName,
            }),
        ];
        this.table.data = this.sheet.relevantSims;
        const showAllCb = labeledCheckbox('Show sims for other jobs', new FieldBoundCheckBox<AddSimDialog>(this, 'showAllSims'));
        form.appendChild(showAllCb);
        const tableHolder = quickElement('div', ['table-holder'], [this.table]);
        form.appendChild(tableHolder);

        const descriptionArea = document.createElement('div');
        descriptionArea.classList.add('add-sim-description');
        descriptionArea.textContent = 'Select a simulation to see a description';

        const contactArea = quickElement('div', ['add-sim-contact-info-holder'], []);
        const descriptionContactArea = quickElement('div', ['add-sim-lower-area'], [descriptionArea, contactArea]);

        form.appendChild(descriptionContactArea);

        const submitButton = makeActionButton("Add", () => this.submit());
        const cancelButton = makeActionButton("Cancel", () => this.close());
        this.addButton(submitButton);
        this.addButton(cancelButton);

        selModel.addListener({
            onNewSelection(newSelection) {
                if (newSelection instanceof CustomRow) {
                    submitButton.disabled = false;
                    const desc = newSelection.dataItem.description;
                    if (desc !== undefined) {
                        descriptionArea.textContent = desc;
                        descriptionArea.classList.remove('no-desc');
                    }
                    else {
                        descriptionArea.textContent = '(No Description)';
                        descriptionArea.classList.add('no-desc');
                    }
                    const maintainersElement = simMaintainersInfoElement(newSelection.dataItem);
                    if (maintainersElement) {
                        contactArea.replaceChildren(maintainersElement);
                        contactArea.style.display = '';
                    }
                    else {
                        contactArea.replaceChildren();
                        contactArea.style.display = 'none';
                    }
                }
                else {
                    submitButton.disabled = true;
                }
            },
        });
        this.contentArea.append(form);
    }

    submit() {
        const sel = this.table.selectionModel.getSelection();
        if (sel instanceof CustomRow) {
            this.sheet.addSim(sel.dataItem.makeNewSimInstance());
            this.close();
        }
    }

    get showAllSims(): boolean {
        return this._showAllSims;
    }

    set showAllSims(showAll: boolean) {
        this._showAllSims = showAll;
        this.table.data = showAll ? getRegisteredSimSpecs() : this.sheet.relevantSims;
    }
}

customElements.define("add-sim-dialog", AddSimDialog);
