import {BaseModal} from "@xivgear/common-ui/components/modal";
import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {makeActionButton} from "@xivgear/common-ui/components/util";
import {JobName} from "@xivgear/xivmath/xivconstants";
import {parseImport} from "@xivgear/core/imports/imports";
import {getShortLink} from "@xivgear/core/external/shortlink_server";
import {getSetFromEtro} from "@xivgear/core/external/etro_import";
import {getBisSheet} from "@xivgear/core/external/static_bis";
import {SetExport} from "@xivgear/xivmath/geartypes";
import {GearPlanSheetGui} from "../sheet/sheet_gui";

export class ImportSetsModal extends BaseModal {
    private readonly loader: LoadingBlocker;
    private readonly importButton: HTMLButtonElement;
    private readonly textArea: HTMLTextAreaElement;

    constructor(private sheet: GearPlanSheetGui) {
        super();
        this.headerText = 'Import Gear Set(s)';

        const explanation = document.createElement('p');
        explanation.textContent = 'This is for importing gear set(s) into this sheet. If you would like to import a full sheet export (including sim settings) to a new sheet, use the "Import Sheet" at the top of the page. '
            + 'You can import a gear planner URL or JSON, or an Etro URL.';
        this.contentArea.appendChild(explanation);

        const textAreaDiv = document.createElement("div");
        textAreaDiv.id = 'set-import-textarea-holder';

        this.textArea = document.createElement("textarea");
        this.textArea.id = 'set-import-textarea';
        textAreaDiv.appendChild(this.textArea);
        this.loader = new LoadingBlocker();
        this.loader.classList.add('with-bg');


        textAreaDiv.appendChild(this.loader);
        this.contentArea.appendChild(textAreaDiv);
        // textAreaDiv.appendChild(document.createElement("br"));

        this.importButton = makeActionButton("Import", () => this.doImport());
        this.addButton(this.importButton);
        this.addCloseButton();
        this.ready = true;
    }

    get ready() {
        return !this.importButton.disabled;
    }

    set ready(ready: boolean) {
        if (ready) {
            this.loader.hide();
            this.importButton.disabled = false;
        }
        else {
            this.loader.show();
            this.importButton.disabled = true;
        }
    }

    checkJob(plural: boolean, ...importedJobs: JobName[]): boolean {
        const nonMatchingJobs = importedJobs.filter(job => !this.sheet.allJobs.includes(job));
        if (nonMatchingJobs.length > 0) {
            const flaggedJobs = nonMatchingJobs.join(', ');
            // TODO: *try* to import some sims, or at least load up the defaults.
            let msg;
            if (plural) {
                msg = `You are trying to import ${flaggedJobs} set(s) into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            else {
                msg = `You are trying to import a ${flaggedJobs} set into a ${this.sheet.classJobName} sheet. Class-specific items, such as weapons, will need to be re-selected.`;
            }
            return confirm(msg);
        }
        else {
            return true;
        }

    }

    doImport() {
        const text = this.textArea.value.trim();
        const parsed = parseImport(text);
        if (parsed) {
            switch (parsed.importType) {
                case "json":
                    try {
                        this.doJsonImport(parsed.rawData, undefined);
                    }
                    catch (e) {
                        console.error('Import error', e);
                        alert('Error importing');
                    }
                    return;
                case "shortlink":
                    this.doAsyncImport(() => getShortLink(decodeURIComponent(parsed.rawUuid)), parsed.onlySetIndex);
                    return;
                case "etro":
                    this.ready = false;
                    Promise.all(parsed.rawUuids.map(getSetFromEtro)).then(sets => {
                        if (!this.checkJob(false, ...sets.map(set => set.job))) {
                            this.ready = true;
                            return;
                        }
                        sets.forEach(set => {
                            this.sheet.addGearSet(this.sheet.importGearSet(set), undefined, true);
                        });
                        console.log("Imported set(s) from Etro");
                        this.close();
                    }, err => {
                        this.ready = true;
                        console.error("Error loading set from Etro", err);
                        alert('Error loading Etro set');
                    });
                    return;
                case "bis":
                    this.doAsyncImport(() => getBisSheet(parsed.path), parsed.onlySetIndex);
                    return;
            }
        }
        console.error("Error loading imported data", text);
        alert('That doesn\'t look like a valid import.');
    }

    doAsyncImport(provider: () => Promise<string>, onlySetIndex: number | undefined) {
        this.ready = false;
        provider().then(raw => {
            this.doJsonImport(raw, onlySetIndex);
            this.ready = true;
        }, err => {
            this.ready = true;
            console.error("Error importing set/sheet", err);
            alert('Error loading set/sheet');
        });
    }

    doJsonImport(text: string, onlySetIndex: number | undefined) {
        const rawImport = JSON.parse(text);
        if ('sets' in rawImport && rawImport.sets.length) {
            if (!this.checkJob(true, rawImport.job)) {
                return;
            }
            const sets: SetExport[] = rawImport.sets;
            if (onlySetIndex !== undefined) {
                const theSet = sets[onlySetIndex];
                if (!theSet) {
                    console.error(`Index ${onlySetIndex} is not valid with sets length of ${sets.length}`);
                    alert("Not valid");
                }
                const imported = this.sheet.importGearSet(theSet);
                this.sheet.addGearSet(imported, undefined, true);
            }
            else {
                // import everything
                if (confirm(`This will import ${rawImport.sets.length} gear sets into this sheet.`)) {
                    const imports = sets.map(set => this.sheet.importGearSet(set));
                    for (let i = 0; i < imports.length; i++) {
                        // Select the first imported set
                        const set = imports[i];
                        this.sheet.addGearSet(set, undefined, i === 0);
                    }
                }
            }
            this.close();
        }
        else if ('name' in rawImport && 'items' in rawImport) {
            if (!this.checkJob(false, rawImport.job)) {
                return;
            }
            this.sheet.addGearSet(this.sheet.importGearSet(rawImport), undefined, true);
            this.close();
        }
        else {
            alert("That doesn't look like a valid sheet or set");
        }

    }
}

customElements.define("import-set-dialog", ImportSetsModal);
