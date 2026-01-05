import {LoadingBlocker} from "@xivgear/common-ui/components/loader";
import {recordEvent} from "@xivgear/common-ui/analytics/analytics";

let popoutElement: HTMLDivElement;
// Interval ID for monitoring the parent window's navigation state
let parentMonitorInterval: number | undefined;
let initialOpenerHref: string | undefined;

export function getPopoutDiv(): HTMLDivElement | undefined {
    return popoutElement;
}

export function isPopout() {
    return window.parentSheet !== undefined;
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

function safeGetOpenerHref(): string | undefined {
    try {
        const op: Window | null = window.opener;
        if (!op || op.closed) {
            return undefined;
        }
        return op.location.href;
    }
    catch (e) {
        // Cross-origin or inaccessible opener
        return undefined;
    }
}

function startParentMonitor() {
    if (parentMonitorInterval !== undefined) {
        return; // already monitoring
    }
    initialOpenerHref = safeGetOpenerHref();
    parentMonitorInterval = window.setInterval(() => {
        const op: Window | null = window.opener;
        // If there is no opener, or it is closed, close this popup
        if (!op || op.closed) {
            doClose();
            return;
        }
        // If we cannot read href (cross-origin) or it changed, consider it navigated away
        const href = safeGetOpenerHref();

        function doClose() {
            if (parentMonitorInterval !== undefined) {
                window.clearInterval(parentMonitorInterval);
                parentMonitorInterval = undefined;
            }
            window.close();
        }

        if (href === undefined || (initialOpenerHref !== undefined && href !== initialOpenerHref)) {
            doClose();
            return;
        }
        if (window.parentSheet !== op.currentSheet) {
            doClose();
            return;
        }
    }, 500);

    // Cleanup the interval when this popup is closing
    window.addEventListener('beforeunload', () => {
        if (parentMonitorInterval !== undefined) {
            window.clearInterval(parentMonitorInterval);
            parentMonitorInterval = undefined;
        }
    });
}

export type PopoutMainElement = HTMLElement & {
    refreshToolbar: () => void;
    refreshContent: () => void;
};

export const MESSAGE_REFRESH_CONTENT = 'refreshContent';
export const MESSAGE_REFRESH_TOOLBAR = 'refreshToolbar';

export function openPopout(element: PopoutMainElement) {
    recordEvent('openPopout');
    console.log("openPopout start");
    if (!popoutElement) {
        earlyPopooutInit();
    }
    popoutElement.replaceChildren(element);
    // Hook message receiver if provided
    window.addEventListener('message', (event: MessageEvent<{
        type: string
    }>) => {
        if (event?.data?.type === MESSAGE_REFRESH_CONTENT) {
            element.refreshContent();
        }
        if (event?.data?.type === MESSAGE_REFRESH_TOOLBAR) {
            element.refreshToolbar();
        }
    });
    // Start monitoring the parent navigation state; if it changes, close the popup
    startParentMonitor();
}

let currentContextNumber: number = 0;

export function getNextPopoutContext(): string {
    // TODO: inline the ++ operation
    currentContextNumber++;
    return `popout-${currentContextNumber}`;
}
