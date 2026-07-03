import {LoadingBlocker} from "@xivgear/common-ui/components/loader";

import {setTitle, showFatalError} from "./base_ui";
import {GearPlanSheetGui} from "./components/sheet/sheet_gui";
import {recordError, recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {makeUrl, NavState, ONLY_SET_QUERY_PARAM} from "@xivgear/core/nav/common_nav";
import {getCurrentHash, getCurrentState} from "./nav_hash";
import {recordSheetEvent} from "./analytics/analytics";

import {makeNewTabIcon} from "@xivgear/common-ui/components/icons";
import {elt} from "@xivgear/common-ui/components/templates";

let embedDiv: HTMLDivElement;

const OPEN_FULL_OPTIONS = [
    'Click to Open Full View',
    'Open Full View',
    'View on Xivgear',
    'View/Edit on Xivgear',
    'View Full Gear Set',
    'View Full Stats',
    'Show More',
    'Show Full',
    'Expand View',
    'Open in New Tab',
];

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

        const buttonText = OPEN_FULL_OPTIONS[Math.floor(Math.random() * OPEN_FULL_OPTIONS.length * 0.999)] ?? 'Open Full';
        const hash = getCurrentHash();
        const linkUrl = makeUrl(new NavState(hash.slice(1), undefined, getCurrentState().onlySetIndex));
        linkUrl.searchParams.delete(ONLY_SET_QUERY_PARAM);

        const openFullLink = elt('a', {
            class: 'embed-open-full-link',
            props: {
                href: linkUrl.toString(),
                target: '_blank',
            },
        })`${buttonText}${makeNewTabIcon()}`;

        openFullLink.addEventListener('click', () => {
            recordSheetEvent("openEmbedToFull", sheet, {
                buttonText: buttonText,
            });
        });

        embedDiv.replaceChildren(openFullLink, editorArea);

        console.log("openEmbed end");
        setTitle('Embed');
    }
    catch (e) {
        recordError('openEmbed', e);
        console.error("Error loading embed", e);
        showFatalError("Error loading embed");
    }
}
