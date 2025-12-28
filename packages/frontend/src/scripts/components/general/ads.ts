import {recordError, recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {arrayEq} from "@xivgear/util/array_utils";

type DisplayCondition = (width: number, height: number) => boolean;

/**
 * Represents an ad and associated elements
 */
type AdContainerElements = {
    /**
     * The ad div itself
     */
    inner: HTMLDivElement,
    /**
     * Holds the ad and links. Also used for horizontal positioning relative to the outer.
     */
    middle: HTMLDivElement,
    /**
     * The outer, determines vertical position.
     */
    outer: HTMLDivElement,

    linksHolder: HTMLDivElement,
}

declare global {
    interface Window {
        nitroAds?: {
            createAd(id: string, props: unknown): void;
            loaded: boolean;
        };
        currentAds?: ManagedAd[];

        __cmp(...args: unknown[]): void;

        __uspapi(...args: unknown[]): void;

        recheckAds(): void;
    }
}

const X_PADDING = 10;
const Y_PADDING = 50;

type AdSide = 'left' | 'right';

/**
 * Manages a single ad
 */
class ManagedAd {
    readonly adContainer: AdContainerElements;
    private readonly condition: DisplayCondition;
    private _showing: boolean = false;
    private _installed: boolean = false;
    private readonly adSize: AdContainerSize;
    private ad: unknown;
    private readonly adSizes: AdSize[];

    constructor(public readonly id: string, outerSize: AdContainerSize, condition: DisplayCondition, readonly adSide: AdSide, useMinSize: boolean = false) {
        this.adContainer = makeFixedArea(id, outerSize[0], outerSize[1], adSide, useMinSize);
        this.adSize = outerSize;
        this.adSizes = AdSizes.filter(size => size[0] <= outerSize[0] && size[1] <= outerSize[1]);
        this.condition = condition;
        if (adSide === 'left') {
            this.adContainer.outer.style.left = '0';
            this.adContainer.middle.style.marginLeft = '-5px';
            this.adContainer.middle.style.borderRadius = '0 10px 0 0';
        }
        else if (adSide === 'right') {
            this.adContainer.outer.style.left = '100%';
            this.adContainer.middle.style.right = '0';
            this.adContainer.middle.style.marginRight = '-5px';
            this.adContainer.middle.style.borderRadius = '10px 0 0 0';
        }
    }

    /**
     * Whether this ad is showing at all
     */
    get showing() {
        return this._showing;
    }

    set showing(value: boolean) {
        console.debug("set showing", value);
        // ignore no-ops, except when ads were not installed due to the script not having loaded yet
        if (value !== this._showing || (value && !this._installed)) {
            if (value) {
                this.adContainer.outer.style.display = '';
                this.adContainer.middle.prepend(this.adContainer.inner);
                this.installAdPlacement();
                // if (!this._installed) {
                // }
                // setTimeout(() => this.ad['checkVisible'](), 100);
            }
            else {
                this.adContainer.outer.style.display = 'none';
                this.adContainer.middle.removeChild(this.adContainer.inner);
            }
            this._showing = value;
        }
    }

    onNavigate(): void {
        //     // this.ad?.['onNavigate']?.();
        //     if (this.showing) {
        //         this.installAdPlacement();
        //     }
    }

    /**
     * Install the ad code if it has not already been installed for this ad
     */
    private installAdPlacement(): void {
        const element = this.adContainer.inner;
        let id = element.id;
        if (!id) {
            element.id = id = 'random-id-' + idCounter++;
        }
        if (!adsEnabled()) {
            return;
        }
        setTimeout(() => {
            console.debug(`createAd: ${this.id}`);
            this.ad = window.nitroAds.createAd(id, {
                "refreshTime": 30,
                "renderVisibleOnly": true,
                "sizes": this.adSizes.map(es => [es[0].toString(), es[1].toString()]),
                "report": {
                    "enabled": true,
                    "icon": true,
                    "wording": "Report Ad",
                    "position": "top-right",
                },
            });
            recordEvent('createAd', {'id': id});
        }, 50);
        this._installed = true;
    }

    /**
     * Based on the new screen size, determine if this ad should be displayed
     */
    recheck(): void {
        const parentElement = this.adContainer.outer.parentElement;
        if (!parentElement) {
            this.showing = false;
            return;
        }
        const width = parentElement.clientWidth;
        const height = parentElement.clientHeight;
        this.showing = this.condition(width, height) && adsEnabled();
    }

    addExtras(extraLinks: HTMLElement[]) {
        if (!arrayEq(extraLinks, Array.from(this.adContainer.linksHolder.childNodes))) {
            console.debug("New children", extraLinks);
            this.adContainer.linksHolder.replaceChildren(...extraLinks);
        }
    }
}


window.addEventListener('nitroAds.loaded', () => {
    console.debug('nitroAds.loaded');
    recheckAds();
});

/**
 * Whether ads are enabled
 */
function adsEnabled(): boolean {
    return window.nitroAds?.loaded ?? false;
}


function makeFixedArea(id: string, width: number, height: number, side: AdSide, useMinSize: boolean): AdContainerElements {
    const inner = document.createElement('div');
    if (useMinSize) {
        inner.style.height = `${height}px`;
        inner.style.width = `${width}px`;
    }
    inner.id = id;

    const middle = document.createElement('div');
    middle.appendChild(inner);
    middle.style.position = 'absolute';
    middle.style.backgroundColor = 'var(--table-bg-color)';
    middle.style.display = '';
    middle.style.zIndex = '-99';
    middle.style.bottom = '0';
    middle.style.boxSizing = 'content-box';
    middle.style.marginBottom = '-8px';
    if (side === 'left') {
        middle.style.padding = '5px 5px 0 0';
    }
    else if (side === 'right') {
        middle.style.padding = '5px 0 0 5px';
    }
    middle.classList.add('shadow-big');

    const extraLinksHolder = document.createElement('div');
    extraLinksHolder.style.display = 'contents';
    middle.appendChild(extraLinksHolder);

    const outer = document.createElement('div');
    outer.style.position = 'sticky';
    outer.style.left = '0';
    outer.style.top = '100%';
    // outer.style.bottom = `${height}px`;
    outer.style.width = '0';
    outer.style.height = '0';
    outer.style.display = 'none';
    outer.appendChild(middle);

    return {
        inner: inner,
        middle: middle,
        outer: outer,
        linksHolder: extraLinksHolder,
    };
}

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
// Sizes of the ads themselves (predetermined)
type AdSize = typeof AdSizes[number];
// Sizes of the ad container (our choice)
const AdContainerSizes = [
    [336, 600],
    [336, 280],
    [300, 600],
    [300, 250],
    [160, 600],
    [320, 100],
    [320, 50],
    [970, 250],
    [970, 90],
    [728, 90],
] as const;
type AdContainerSize = typeof AdContainerSizes[number];
// const foo: AdContainerSize = [300, 250];

let idCounter = 1;

const currentAds: ManagedAd[] = [];
const extraLinksHolderInner = document.createElement('div');
extraLinksHolderInner.style.display = 'content';

window.addEventListener('resize', recheckAds);

window.currentAds = currentAds;

let lastReported: ManagedAd[] | undefined = undefined;

function recheckAds() {
    setTimeout(() => {

        console.debug('recheckAds');
        let oneLeftAdShown = false;
        if (adsEnabled()) {
            currentAds.forEach(ad => {
                ad.recheck();
                console.debug(`recheckAds: ${ad.id} => ${ad.showing}`);
                if (ad.showing && ad.adSide === 'left' && !oneLeftAdShown) {
                    oneLeftAdShown = true;
                    ad.addExtras([extraLinksHolderInner]);
                }
            });
            window.__cmp?.('addConsentLink');
            window.__uspapi?.('addLink', 1);
            const showing = currentAds.filter(ad => ad.showing);
            // Debounce this reporting so it doesn't spam hundreds of events when resizing a window
            if (!arrayEq(showing, lastReported)) {
                if (showing.length > 0) {
                    recordEvent('shownAds', {
                        shownAds: showing.map(ad => ad.id).join(","),
                        count: showing.length,
                    });
                }
                else {
                    recordEvent('shownAds', {
                        shownAds: 'none',
                        count: 0,
                    });
                }
                lastReported = showing;
            }
        }
        else {
            console.debug('recheckAds: not enabled');
        }
        if (oneLeftAdShown) {
            fallbackPrivacyArea.style.display = 'none';
        }
        else {
            fallbackPrivacyArea.style.display = '';
            moveLinksToFallbackPrivacyArea();

        }
    });
}

window.recheckAds = recheckAds;

let firstLoad = true;

let currentAdParent: HTMLElement | null = null;

export function insertAds(newElement: HTMLElement) {

    setTimeout(
        () => {
            const oldParent = currentAdParent;
            currentAdParent = newElement;
            if (currentAds.length === 0) {
                // Analytics
                setTimeout(() => {
                    // Everything good
                    if (adsEnabled()) {
                        recordEvent('adsEnabled', {'page': document.location.search});
                    }
                    // Script present, but blocked from working correctly
                    else if (Array.from(document.head.querySelectorAll('script')).find(script => script.src && script.src.includes('nitro'))) {
                        recordEvent('adsDisabled', {'page': document.location.search});
                    }
                    // Script injected, but was later removed
                    else if (document.documentElement.getAttribute('scripts-injected') === 'true') {
                        recordEvent('adsScriptRemoved', {'page': document.location.search});
                    }
                    // Script not injected by server
                    else {
                        recordEvent('adsNotInjected', {'page': document.location.search});
                    }
                }, 10_000);

                try {

                    // Determines the actual width of the page content
                    function contentWidth() {
                        const children = currentAdParent.querySelectorAll('.weapon-table, .left-side-gear-table, .right-side-gear-table, .food-items-table');
                        let leftBound = 999999;
                        let rightBound = -999999;
                        children.forEach(child => {
                            const bound = child.getBoundingClientRect();
                            leftBound = Math.min(leftBound, bound.left);
                            rightBound = Math.max(rightBound, bound.right);
                        });
                        return Math.max(0, rightBound - leftBound);
                    }

                    function horizFit(parentWidth: number, adWidth: number) {
                        return parentWidth >= contentWidth() + 2 * (adWidth + X_PADDING);
                    }

                    const existing: DisplayCondition[] = [];

                    // Add mutual exclusion to a condition.
                    // The first caller of this gets priority, i.e. call in descending order of priority.
                    function adCondition(conditionInner: DisplayCondition): DisplayCondition {
                        const previous = [...existing];
                        const dc: DisplayCondition = (w: number, h: number) => {
                            for (const prev of previous) {
                                if (prev(w, h)) {
                                    return false;
                                }
                            }
                            return conditionInner(w, h);
                        };
                        existing.push(dc);
                        return dc;
                    }

                    // Condition for ads which only take up otherwise-empty space
                    function emptySpace(size: AdContainerSize): DisplayCondition {
                        return adCondition((w, h) => {
                            return horizFit(w, size[0]) && h >= size[1] + Y_PADDING;
                        });
                    }

                    const sideXWideCond = emptySpace(AdContainerSizes[0]);
                    const sideXWideShortCond = emptySpace(AdContainerSizes[1]);
                    const sideWideCond = emptySpace(AdContainerSizes[2]);
                    const sideWideShortCond = emptySpace(AdContainerSizes[3]);
                    const sideNarrowCond = emptySpace(AdContainerSizes[4]);

                    {
                        const size: AdContainerSize = [336, 600];
                        const adAreaLeftWide = new ManagedAd('float-area-xwide-left', size, sideXWideCond, 'left');
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-xwide-right', size, sideXWideCond, 'right');
                        currentAds.push(adAreaRightWide);
                    }
                    {
                        const size: AdContainerSize = [336, 280];
                        const adAreaLeftWide = new ManagedAd('float-area-xwide-short-left', size, sideXWideShortCond, 'left');
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-xwide-short-right', size, sideXWideShortCond, 'right');
                        currentAds.push(adAreaRightWide);
                    }
                    {
                        const size: AdContainerSize = [300, 600];
                        const adAreaLeftWide = new ManagedAd('float-area-wide-left', size, sideWideCond, 'left');
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-wide-right', size, sideWideCond, 'right');
                        currentAds.push(adAreaRightWide);
                    }
                    {
                        const size: AdContainerSize = [300, 250];
                        const adAreaLeftWide = new ManagedAd('float-area-wide-short-left', size, sideWideShortCond, 'left');
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-wide-short-right', size, sideWideShortCond, 'right');
                        currentAds.push(adAreaRightWide);
                    }
                    {
                        const size: AdContainerSize = [160, 600];
                        const adAreaLeftNarrow = new ManagedAd('float-area-narrow-left', size, sideNarrowCond, 'left');
                        currentAds.push(adAreaLeftNarrow);

                        const adAreaRightNarrow = new ManagedAd('float-area-narrow-right', size, sideNarrowCond, 'right');
                        currentAds.push(adAreaRightNarrow);
                    }

                    function floatAd(size: AdContainerSize, minContentSize: [w: number, h: number], name: string): void {
                        const cond: DisplayCondition = adCondition((w, h) => {
                            return w >= minContentSize[0] && h >= minContentSize[1];
                        });
                        const adArea = new ManagedAd(name, size, cond, 'right');
                        adArea.adContainer.outer.style.zIndex = '194';
                        currentAds.push(adArea);
                    }

                    // This one just feels too big.
                    // floatAd([970, 250], [1100, 800], 'float-area-narrow-largest-right');
                    floatAd([970, 90], [1100, 580], 'corner-area-narrow-large-right');
                    floatAd([728, 90], [800, 500], 'corner-area-narrow-med-right');
                    floatAd([320, 100], [400, 500], 'corner-area-narrow-short-right');
                    floatAd([320, 50], [400, 300], 'corner-area-narrow-shorter-right');
                }
                catch (e) {
                    recordError('insertAds', e);
                    console.error(e);
                }
            }
            if (newElement !== oldParent) {
                currentAds.forEach(ad => ad.showing = false);
                currentAdParent.prepend(...currentAds.map(a => a.adContainer.outer));
            }
            setTimeout(recheckAds);
            setTimeout(recheckAds, 2_000);
            if (firstLoad) {
                firstLoad = false;
            }
            else {
                setTimeout(() => currentAds.forEach(ad => ad.onNavigate()));
            }
        },
        200);
}

// set up extra links

{
    const extraLinks: HTMLElement[] = [];
    {
        // General privacy policy
        const privacyPolicyLink = document.createElement('a');
        privacyPolicyLink.textContent = 'Privacy';
        privacyPolicyLink.href = "#";
        privacyPolicyLink.addEventListener('click', (ev) => {
            ev.preventDefault();
            showPrivacyPolicyModal();
        });
        extraLinks.push(privacyPolicyLink);
    }

    {
        // CCPA-specific link
        const ccpaLink = document.createElement('span');
        ccpaLink.setAttribute('data-ccpa-link', '1');
        ccpaLink.addEventListener('click', () => recordEvent('openCcpa'));
        extraLinks.push(ccpaLink);
    }

    {
        // GDPR-specific link
        const gdprLink = document.createElement('div');
        gdprLink.id = 'ncmp-consent-link';
        gdprLink.addEventListener('click', () => recordEvent('openGdpr'));
        extraLinks.push(gdprLink);
    }
    extraLinks.forEach(el => el.classList.add('extra-information-link'));
    extraLinksHolderInner.replaceChildren(...extraLinks);
}

// Used as a fallback place to display privacy links if there are no ad areas
// TODO: this should attach at the top-level rather than as part of the editor, so that the privacy link can appear
// on all pages.
const fallbackPrivacyArea = document.createElement('div');
fallbackPrivacyArea.id = 'fallback-privacy-area';
fallbackPrivacyArea.classList.add('shadow');

function moveLinksToFallbackPrivacyArea() {
    fallbackPrivacyArea.replaceChildren(extraLinksHolderInner);
}

export function installFallbackPrivacyArea() {
    moveLinksToFallbackPrivacyArea();
    document.querySelector('body')?.appendChild(fallbackPrivacyArea);
}

class PrivacyPolicyModal extends BaseModal {
    constructor() {
        super();
        this.headerText = 'Privacy Policy';
        const element = document.createElement('div');
        this.contentArea.appendChild(element);
        this.contentArea.style.textAlign = 'left';
        this.contentArea.style.padding = '25px';
        this.inner.style.maxWidth = '1200px';
        this.inner.style.maxHeight = '900px';
        this.addCloseButton();
        element.innerHTML = 'Loading...';
        element.style.width = '1200px';
        element.style.height = '900px';
        import(/* webpackChunkName: "privacy" */ '@xivgear/gearplan-frontend/components/general/privacy').then(mod => {
            element.innerHTML = mod.getPrivacyHtml();
            element.style.width = '';
            element.style.height = '';
        }).catch(() => {
            element.innerHTML = 'Error loading';
        });
    }
}

export function showPrivacyPolicyModal() {
    console.log('Opening privacy policy modal.');
    recordEvent('openPrivacyPolicy');
    new PrivacyPolicyModal().attachAndShowTop();
}

customElements.define('privacy-policy-modal', PrivacyPolicyModal);
