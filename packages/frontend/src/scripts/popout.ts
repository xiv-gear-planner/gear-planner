import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {recordEvent} from "@xivgear/common-ui/analytics/analytics";

let popoutElement: HTMLDivElement;

export function getPopoutDiv(): HTMLDivElement | undefined {
    return popoutElement;
}

export function earlyPopooutInit() {
    console.log("Popout early init");
    const body = document.body;
    body.childNodes
        .forEach((element) => {
            if ('style' in element) {
                (element as HTMLElement).style.display = 'none';
            }
        });
    popoutElement = document.createElement('div');
    popoutElement.id = 'popout-top-level';
    popoutElement.appendChild(new LoadingBlocker());
    body.appendChild(popoutElement);
    body.classList.add('popout-view');
}

export function openPopout(element: HTMLElement) {
    recordEvent('openPopout');
    console.log("openPopout start");
    if (!popoutElement) {
        earlyPopooutInit();
    }
    popoutElement.replaceChildren(element);
}
