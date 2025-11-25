import {LoadingBlocker} from "@xivgear/common-ui/components/loader";

import {setTitle, showFatalError} from "./base_ui";
import {GearPlanSheetGui} from "./components/sheet/sheet_gui";
import {recordError, recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {makeUrl, NavState, ONLY_SET_QUERY_PARAM} from "@xivgear/core/nav/common_nav";
import {getCurrentHash, getCurrentState} from "./nav_hash";
import {recordSheetEvent} from "./analytics/analytics";

import {makeNewTabIcon} from "@xivgear/common-ui/components/icons";

let embedDiv: HTMLDivElement;

export function getEmbedDiv(): HTMLDivElement | undefined {
    return embedDiv;
}

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
    body.classList.add('embed-view');
}

export async function openEmbed(sheet: GearPlanSheetGui) {
    recordEvent('openEmbed');
    console.log("openEmbed start");
    sheet.isEmbed = true;
    try {
        await sheet.load();
        console.log("openEmbed mid");
        const editorArea = sheet.editorArea;

        // const placeHolder = editorArea.querySelector("a#embed-stats-placeholder");
        // placeHolder.parentElement.insertBefore(statTotals, placeHolder);

        embedDiv.replaceChildren(editorArea);

        const openFullLink = document.createElement('a');
        openFullLink.classList.add('embed-open-full-link');
        const hash = getCurrentHash();
        const linkUrl = makeUrl(new NavState(hash.slice(1), undefined, getCurrentState().onlySetIndex));
        linkUrl.searchParams.delete(ONLY_SET_QUERY_PARAM);
        openFullLink.href = linkUrl.toString();
        openFullLink.target = '_blank';
        openFullLink.addEventListener('click', () => {
            recordSheetEvent("openEmbedToFull", sheet);
        });
        openFullLink.replaceChildren('Click to open full view ', makeNewTabIcon());

        // const body = document.body;
        // body.prepend(openFullLink);
        embedDiv.prepend(openFullLink);

        console.log("openEmbed end");
        setTitle('Embed');
    }
    catch (e) {
        recordError('openEmbed', e);
        console.error("Error loading embed", e);
        showFatalError("Error loading embed");
    }
}
