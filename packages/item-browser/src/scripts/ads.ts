// Sizes of the ads themselves (predetermined)
import {recheckNow} from "./item-detail-layout";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AdSizes = [
    [300, 600],
    [336, 280],
    [320, 480],
    [160, 600],
    [300, 250],
    [970, 250],
    [970, 90],
    [728, 90],
    [320, 100],
    [320, 50],
] as const;
type AdSize = typeof AdSizes[number];


declare global {
    interface Window {
        nitroAds?: {
            createAd(id: string, options: {
                demo?: boolean;
                height: number;
                delayLoading: boolean;
                report: {
                    enabled?: boolean,
                    icon?: boolean,
                    iconColor?: string,
                    wording?: string,
                    position?: string,
                }
            }): void;
        };
    }
}

function sizeFor(width: number, context: string): AdSize {
    let sizes: AdSize[];
    switch (context) {
        case 'results':
            sizes = [[300, 250]];
            break;
        case 'detail':
            sizes = [[336, 280], [320, 480], [300, 250], [300, 600], [160, 600]];
            break;
        default:
            sizes = [[970, 90], [728, 90], [320, 100], [320, 50], [160, 600]];
            break;
    }

    return sizes.find(size => size[0] <= width) ?? sizes[sizes.length - 1];
}

function initializeAd(element: HTMLElement): void {
    const width = element.clientWidth || element.parentElement?.clientWidth || 320;
    const [adWidth, adHeight] = sizeFor(width, element.dataset.adContext ?? 'short');
    const sameSize = element.dataset.adWidth === String(adWidth) && element.dataset.adHeight === String(adHeight);
    if (sameSize && (element.dataset.adCreated === 'true' || !window.nitroAds?.createAd)) {
        return;
    }
    element.style.height = `${adHeight}px`;
    element.dataset.adWidth = String(adWidth);
    element.dataset.adHeight = String(adHeight);
    element.replaceChildren();

    if (!window.nitroAds?.createAd) {
        // element.textContent = 'Ad goes here';
        return;
    }
    window.nitroAds.createAd(element.id, {
        demo: !document.location.hostname.includes("xivgear.app"),
        height: adHeight,
        delayLoading: true,
        report: {
            enabled: true,
            icon: true,
            wording: 'Report Ad',
            position: 'top-right',
        },
    });
    element.dataset.adCreated = 'true';
    recheckNow();
}

document.addEventListener('nitroAds.loaded', () => {
    console.log('nloaded');
    initializeAds();
});

function initializeAds(root: ParentNode = document): void {
    // @ts-expect-error don't have this type def
    if (window.nitroAds?.loaded) {
        root.querySelectorAll<HTMLElement>('[data-nitro-ad]').forEach(element => {
            document.body?.classList.add('nloaded');
            initializeAd(element);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => initializeAds());
document.addEventListener('htmx:load', event => {
    const detail = event as CustomEvent<{
        elt?: Element
    }>;
    initializeAds(detail.detail?.elt ?? document);
});
document.addEventListener('htmx:afterSwap', event => {
    const detail = event as CustomEvent<{
        target?: Element
    }>;
    initializeAds(detail.detail?.target ?? document);
});

