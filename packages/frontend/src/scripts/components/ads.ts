import {recordEvent} from "@xivgear/core/analytics/analytics";

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
    /**
     * Extra elements which can be shown or hidden, e.g. privacy policy
     */
    extraElements: HTMLElement[]
}

/**
 * Manages a single ad
 */
class ManagedAd {
    readonly adContainer: AdContainerElements;
    private readonly condition: DisplayCondition;
    private _showing: boolean = false;
    private _showExtras: boolean = false;
    private _installed: boolean = false;
    private readonly adSize: AdSize;

    constructor(public readonly id: string, size: AdSize, condition: DisplayCondition) {
        this.adContainer = makeFixedArea(id, size[0], size[1]);
        this.adSize = size;
        this.condition = condition;
    }

    /**
     * Whether this ad is showing at all
     */
    get showing() {
        return this._showing;
    }

    set showing(value: boolean) {
        // ignore no-ops, except when ads were not installed due to the script not having loaded yet
        if (value !== this._showing || (value && !this._installed)) {
            if (value) {
                this.adContainer.outer.style.display = '';
                this.installAdPlacementsIfNeeded();
            }
            else {
                this.adContainer.outer.style.display = 'none';
            }
            this._showing = value;
        }
    }

    /**
     * Whether this ad should show the Privacy Policy and, if applicable, CCPA and GDPR links.
     */
    get showExtras() {
        return this._showExtras;
    }

    set showExtras(value: boolean) {
        if (value !== this._showExtras) {
            console.log(`showExtras: ${value} on ${this.adContainer.extraElements.length} elements`);
            this.adContainer.extraElements.forEach(el => el.style.display = (value ? 'block' : 'none'));
        }
        this._showExtras = value;
    }

    /**
     * Install the ad code if it has not already been installed for this ad
     */
    private installAdPlacementsIfNeeded(): void {
        if (!this._installed) {
            return;
        }
        const element = this.adContainer.inner;
        let id = element.id;
        if (!id) {
            element.id = id = 'random-id-' + idCounter++;
        }
        if (!adsEnabled()) {
            return;
        }
        setTimeout(() => {
            window['nitroAds']?.createAd(id, {
                "refreshTime": 30,
                "renderVisibleOnly": true,
                "sizes": [
                    [
                        this.adSize[0].toString(),
                        this.adSize[1].toString()
                    ]
                ],
                "report": {
                    "enabled": true,
                    "icon": true,
                    "wording": "Report Ad",
                    "position": "top-right"
                },
            });
        });
        this._installed = true;
    }

    /**
     * Based on the new screen size, determine if this ad should be displayed
     *
     * @param width
     * @param height
     */
    recheck(width: number, height: number): void {
        this.showing = this.condition(width, height) && adsEnabled();
    }

    addExtras(extraLinks: HTMLElement[]) {
        this.adContainer.middle.replaceChildren(this.adContainer.inner, ...extraLinks);
    }
}

/**
 * Whether ads are enabled
 */
function adsEnabled(): boolean {
    return window['nitroAds'] !== undefined;
}


function makeFixedArea(id: string, width: number, height: number): AdContainerElements {
    const inner = document.createElement('div');
    inner.style.height = `${height}px`;
    inner.style.width = `${width}px`;

    const middle = document.createElement('div');
    middle.appendChild(inner);
    middle.id = id;
    middle.style.position = 'absolute';
    middle.style.backgroundColor = 'var(--table-bg-color)';
    middle.style.display = '';
    middle.style.zIndex = '-99';
    middle.style.bottom = '0';
    middle.style.padding = '5px';
    middle.style.boxSizing = 'content-box';
    middle.style.marginBottom = '-8px';
    middle.style.padding = '5px';
    middle.classList.add('shadow-big');


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
        // TODO: remove
        extraElements: []
    };
}

type AdSize = [300, 600] | [150, 300];

let idCounter = 1;

const currentAds: ManagedAd[] = [];
const extraLinks: HTMLElement[] = [];

window.addEventListener('resize', recheckAds);

function recheckAds() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    let oneAdShown = false;
    if (adsEnabled()) {
        currentAds.forEach(ad => {
            ad.recheck(width, height);
            console.log(`recheckAds: ${ad.id} => ${ad.showing}`);
            if (ad.showing) {
                if (oneAdShown) {
                    ad.showExtras = false;
                }
                else {
                    ad.showExtras = true;
                    oneAdShown = true;
                    ad.addExtras(extraLinks);
                }
            }
        });
    }
    window['__cmp']?.('addConsentLink');
    window['__uspapi']?.('addLink', 1);
    // const firstShowing = currentAds.find(ad => ad.showExtras);
    // if (firstShowing) {
    //     firstShowing.showExtras = true;
    // }
}

export function insertAds(element: HTMLElement) {

    if (currentAds.length === 0) {

        try {
            const sideWideCond: DisplayCondition = (w, h) => w >= 1900 && h > 800;
            const sideNarrowCond: DisplayCondition = (w, h) => w >= 1700 && h > 550 && !sideWideCond(w, h);
            {
                const size: AdSize = [300, 600];
                const adAreaLeftWide = new ManagedAd('float-area-wide-left', size, sideWideCond);
                {
                    const outer = adAreaLeftWide.adContainer.outer;
                    const middle = adAreaLeftWide.adContainer.middle;
                    outer.style.left = '0';
                    middle.style.marginLeft = '-5px';
                    middle.style.borderRadius = '0 10px 0 0';
                }
                currentAds.push(adAreaLeftWide);

                const adAreaRightWide = new ManagedAd('float-area-wide-right', size, sideWideCond);
                {
                    const outer = adAreaRightWide.adContainer.outer;
                    const middle = adAreaRightWide.adContainer.middle;
                    outer.style.left = '100%';
                    middle.style.right = '0';
                    middle.style.marginRight = '-5px';
                    middle.style.borderRadius = '10px 0 0 0';
                }
                currentAds.push(adAreaRightWide);
            }
            {
                const size: AdSize = [150, 300];
                const adAreaLeftNarrow = new ManagedAd('float-area-narrow-left', size, sideNarrowCond);
                {
                    const outer = adAreaLeftNarrow.adContainer.outer;
                    const middle = adAreaLeftNarrow.adContainer.middle;
                    outer.style.left = '0';
                    middle.style.marginLeft = '-5px';
                    middle.style.borderRadius = '0 10px 0 0';
                }
                currentAds.push(adAreaLeftNarrow);

                const adAreaRightNarrow = new ManagedAd('float-area-narrow-right', size, sideNarrowCond);
                {
                    const outer = adAreaRightNarrow.adContainer.outer;
                    const middle = adAreaRightNarrow.adContainer.middle;
                    outer.style.left = '100%';
                    middle.style.right = '0';
                    middle.style.marginRight = '-5px';
                    middle.style.borderRadius = '10px 0 0 0';
                }
                currentAds.push(adAreaRightNarrow);
            }
            {
                {
                    // General privacy policy
                    const privacyPolicyLink = document.createElement('a');
                    privacyPolicyLink.textContent = 'Privacy';
                    privacyPolicyLink.href = "#TODO";
                    privacyPolicyLink.addEventListener('click', () => recordEvent('openPrivacyPolicy'));
                    privacyPolicyLink.style.display = 'block';
                    extraLinks.push(privacyPolicyLink);
                }

                {
                    // CCPA-specific link
                    const ccpaLink = document.createElement('span');
                    ccpaLink.setAttribute('data-ccpa-link', '1');
                    ccpaLink.addEventListener('click', () => recordEvent('openCcpa'));
                    ccpaLink.style.display = 'block';
                    extraLinks.push(ccpaLink);
                }

                {
                    // GDPR-specific link
                    const gdprLink = document.createElement('div');
                    gdprLink.id = 'ncmp-consent-link';
                    gdprLink.addEventListener('click', () => recordEvent('openGdpr'));
                    gdprLink.style.display = 'block';
                    extraLinks.push(gdprLink);
                }
            }

            recheckAds();
        }
        catch (e) {
            console.error(e);
        }
    }
    element.prepend(...currentAds.map(a => a.adContainer.outer));
    setTimeout(recheckAds);

}