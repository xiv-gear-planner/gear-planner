import {LoadingBlocker} from "./loader";
import {makeActionButton} from "./util";
import {parseImport} from "../imports/imports";
import {getShortLink} from "../external/shortlink_server";
import {getSetFromEtro} from "../external/etro_import";
import {getBisSheet} from "../external/static_bis";
import {GearPlanSheetGui} from "../components";
import {NamedSection} from "./section";

export class ImportSheetArea extends NamedSection {
    private readonly loader: LoadingBlocker;
    private readonly importButton: HTMLButtonElement;
    private readonly textArea: HTMLTextAreaElement;

    // TODO
    constructor(private sheetOpenCallback: (sheet: GearPlanSheetGui) => Promise<any>) {
        super('Import Sheet');

        const explanation = document.createElement('p');
        explanation.textContent = 'This will import into a new sheet. You can paste a gear planner link, gear planner JSON, or an Etro link.';
        this.contentArea.appendChild(explanation);

        const textAreaDiv = document.createElement("div");
        textAreaDiv.id = 'set-import-textarea-holder';

        this.textArea = document.createElement("textarea");
        this.textArea.id = 'set-import-textarea';
        this.textArea.placeholder = 'Paste the link or JSON here';
        textAreaDiv.appendChild(this.textArea);
        this.loader = new LoadingBlocker();
        this.loader.classList.add('with-bg');


        this.appendChild(this.loader);
        this.contentArea.appendChild(textAreaDiv);
        textAreaDiv.appendChild(document.createElement("br"));

        this.importButton = makeActionButton("Import", () => this.doImport());
        this.contentArea.appendChild(this.importButton);
        this.ready = true;
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

    doImport() {
        const text = this.textArea.value;
        const parsed = parseImport(text);
        if (parsed) {
            switch (parsed.importType) {
                case "json":
                    try {
                        this.doJsonImport(parsed.rawData);
                    }
                    catch (e) {
                        console.error('Import error', e);
                        alert('Error importing');
                    }
                    return;
                case "shortlink":
                    this.doAsyncImport(() => getShortLink(decodeURIComponent(parsed.rawUuid)));
                    return;
                case "etro":
                    this.ready = false;
                    getSetFromEtro(parsed.rawUuid).then(set => {
                        this.sheetOpenCallback(GearPlanSheetGui.fromSetExport(set));
                        console.log("Loaded set from Etro");
                    }, err => {
                        this.ready = true;
                        console.error("Error loading set from Etro", err);
                        alert('Error loading Etro set');
                    });
                    return;
                case "bis":
                    this.doAsyncImport(() => getBisSheet(...parsed.path));
                    return;
            }
        }
        console.error("Error loading imported data", text);
        alert('That doesn\'t look like a valid import.');
    }

    doAsyncImport(provider: () => Promise<string>) {
        this.ready = false;
        provider().then(raw => {
            this.doJsonImport(raw);
        }, err => {
            this.ready = true;
            console.error("Error importing set/sheet", err);
            alert('Error loading set/sheet');
        })
    }

    doJsonImport(text: string) {
        const rawImport = JSON.parse(text);
        if ('sets' in rawImport && rawImport.sets.length) {
            this.sheetOpenCallback(GearPlanSheetGui.fromExport(rawImport));
        }
        else if ('name' in rawImport && 'items' in rawImport) {
            this.sheetOpenCallback(GearPlanSheetGui.fromSetExport(rawImport));
        }
        else {
            alert("That doesn't look like a valid sheet or set");
        }
    }
}