import {LoadingBlocker} from "@xivgear/common-ui/components/loader";

import {setTitle} from "./base_ui";
import {GearPlanSheetGui} from "./components/sheet";

let embedDiv: HTMLDivElement;

export function earlyEmbedInit() {
    console.log("Embed early init");
    const body = document.body;
    body.childNodes
        .forEach((element) => {
            if ('style' in element) {
                (element as HTMLElement).style.display = 'none';
            }
        });
    embedDiv = document.createElement('div');
    embedDiv.id = 'embed-top-level';
    embedDiv.appendChild(new LoadingBlocker());
    body.appendChild(embedDiv);
}

export async function openEmbed(sheet: GearPlanSheetGui) {
    console.log("openEmbed start");
    sheet.isEmbed = true;
    await sheet.load();
    console.log("openEmbed mid");
    const editorArea = sheet.editorArea;
    // TODO: this is bad
    const statTotals = sheet.editorArea.firstChild['toolbar'].firstChild;

    const placeHolder = editorArea.querySelector("a#embed-stats-placeholder");
    placeHolder.parentElement.insertBefore(statTotals, placeHolder);

    embedDiv.replaceChildren(editorArea);
    console.log("openEmbed end");
    setTitle('Embed');
}
