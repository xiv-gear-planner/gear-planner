import {recordEvent} from "@xivgear/core/analytics/analytics";
import {BaseModal} from "@xivgear/common-ui/components/modal";
import {arrayEq} from "../nav_hash";

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
    private ad: unknown;

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
        console.debug("set showing", value);
        // ignore no-ops, except when ads were not installed due to the script not having loaded yet
        if (value !== this._showing || (value && !this._installed)) {
            if (value) {
                console.debug("branch 1", value);
                this.adContainer.outer.style.display = '';
                if (!this._installed) {
                    this.installAdPlacement();
                }
            }
            else {
                console.debug("branch 2", value);
                this.adContainer.outer.style.display = 'none';
            }
            console.debug("branch 3", value);
            this._showing = value;
        }
    }

    onNavigate(): void {
        this.ad?.['onNavigate']?.();
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
            console.debug(`createAd: ${window['nitroAds'] !== undefined}`);
            this.ad = window['nitroAds']?.createAd(id, {
                "refreshTime": 30,
                "renderVisibleOnly": true,
                "sizes": [
                    [
                        this.adSize[0].toString(),
                        this.adSize[1].toString(),
                    ],
                ],
                "report": {
                    "enabled": true,
                    "icon": true,
                    "wording": "Report Ad",
                    "position": "top-right",
                },
            });
        });
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
    recheckAds();
});

/**
 * Whether ads are enabled
 */
function adsEnabled(): boolean {
    return window['nitroAds']?.loaded ?? false;
}


function makeFixedArea(id: string, width: number, height: number): AdContainerElements {
    const inner = document.createElement('div');
    inner.style.height = `${height}px`;
    inner.style.width = `${width}px`;
    inner.id = id;

    const middle = document.createElement('div');
    middle.appendChild(inner);
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

type AdSize = [300, 600] | [160, 600];

let idCounter = 1;

const currentAds: ManagedAd[] = [];
const extraLinksHolderInner = document.createElement('div');
extraLinksHolderInner.style.display = 'content';

window.addEventListener('resize', recheckAds);

function recheckAds() {
    console.debug('recheckAds');
    let oneAdShown = false;
    if (adsEnabled()) {
        currentAds.forEach(ad => {
            ad.recheck();
            console.debug(`recheckAds: ${ad.id} => ${ad.showing}`);
            if (ad.showing && !oneAdShown) {
                oneAdShown = true;
                ad.addExtras([extraLinksHolderInner]);
            }
        });
        window['__cmp']?.('addConsentLink');
        window['__uspapi']?.('addLink', 1);
    }
    if (oneAdShown) {
        fallbackPrivacyArea.style.display = 'none';
    }
    else {
        fallbackPrivacyArea.style.display = '';
        moveLinksToFallbackPrivacyArea();

    }
}

let firstLoad = true;

export function insertAds(element: HTMLElement) {

    if (currentAds.length === 0) {

        try {
            const sideWideCond: DisplayCondition = (w, h) => w >= 1900 && h > 650;
            const sideNarrowCond: DisplayCondition = (w, h) => w >= 1560 && h > 650 && !sideWideCond(w, h);
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
                const size: AdSize = [160, 600];
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
        }
        catch (e) {
            console.error(e);
        }
    }
    element.prepend(...currentAds.map(a => a.adContainer.outer));
    setTimeout(recheckAds);
    if (firstLoad) {
        firstLoad = false;
    }
    else {
        currentAds.forEach(ad => ad.onNavigate());
    }
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

function getPrivacyHtml(): string {
    return "<h1 id=\"privacy-policy\">Privacy Policy</h1>\n" +
        "<p>Last updated October 24th, 2024. </p>\n" +
        "<h2 id=\"definitions\">Definitions</h2>\n" +
        "<p>The &quot;Service&quot; refers to the collective services provided when\n" +
        "you browse to or otherwise interact with the xivgear.app website.</p>\n" +
        "<p>&quot;Advertising Partner&quot; refers to any third party which provides, directly or\n" +
        "indirectly, advertisements which your Browser may display, including providers\n" +
        "such as advertising resellers.</p>\n" +
        "<p>&quot;Browser&quot; refers to a program, commonly referred to as a &quot;web browser&quot;, which\n" +
        "acts as the graphical interface between You and the Service.</p>\n" +
        "<h2 id=\"information-we-collect-and-how-we-use-it\">Information We Collect and How We Use It</h2>\n" +
        "<p>We may collect and store information in connection with Your use of the \n" +
        "Service, including any information You, a web Browser, or any other \n" +
        "client software acting on Your behalf transmits to the service. This \n" +
        "includes all of the following:</p>\n" +
        "<ul>\n" +
        "<li>Data required for a functioning network connnection, such as Your IP address</li>\n" +
        "<li>Data voluntarily provided by Your Browser, including but not limited to \n" +
        "Browser type, version, screen resolution, and referring URL (the page You \n" +
        "were on when You clicked on a link to this Service).</li>\n" +
        "<li>Additional analytics data, such as button clicks and page visit duration</li>\n" +
        "</ul>\n" +
        "<p>The Service does not request any Personally Identifiable Information from You.\n" +
        "You should not enter any Personally Identifiable Information into the website,\n" +
        "as it will be indistinguishable from non-PII data.</p>\n" +
        "<p>If You use the Service to publish any content, then that content will be fully\n" +
        "accessible to any member of the public. Publishing content is only performed\n" +
        "when clicking a button containing the word &quot;Export&quot; or &quot;Share&quot; and \n" +
        "subsequently choosing to generate a link to the content. Published content\n" +
        "is not associated with an individual nor user account. That is, all published\n" +
        "content is published anonymously.</p>\n" +
        "<h2 id=\"information-collected-by-advertising-partners\">Information Collected By Advertising Partners</h2>\n" +
        "<p>Advertising partners may collect similar information. They may use that \n" +
        "information to personalize Your experience and display relevant advertising.</p>\n" +
        "<h2 id=\"cookies\">Cookies</h2>\n" +
        "<p>Cookies are a part of HTTP transactions, where a server can send the client\n" +
        "a &quot;Cookie&quot;, which consists of a key (name), a value, and optionally data\n" +
        "specifying which sites the Cookie is valid for. Upon subsequent visits to\n" +
        "a website where that Cookie is valid, Your Browser may voluntarily send the\n" +
        "Cookie&#39;s key and value back to the server. To understand how Your Browser\n" +
        "stores Cookies on Your device, or decides when to send a Cookie back to a\n" +
        "server, You should consult Your Browser&#39;s documentation. Your Browser may offer\n" +
        "settings which will restrict which Cookies will be accepted. Cookies may be used\n" +
        "to uniquely identify Your Browser, such as to allow You to remain logged into\n" +
        "an account after closing Your Browser, or by advertisers to track You across\n" +
        "multiple different web sites in order to build a profile of Your interests.</p>\n" +
        "<p>The Service itself does not use Cookies, except to track certain privacy \n" +
        "opt-outs. Neither the Service itself, nor our analytics solution (Umami) use\n" +
        "Cookies.</p>\n" +
        "<p>Pages from the Service which Your Browser displays may contain script tag\n" +
        "which request that Your Browser additionally execute scripts from our\n" +
        "Advertising Partners. Should Your Browser execute these scripts, our\n" +
        "Advertising Partners may use Cookies or other tracking technologies (see\n" +
        "below) to serve You customized advertising based on Your interactions with\n" +
        "other websites, and to track Your interactions on this Service. Advertising\n" +
        "partners may use this data for many purposes, including customizing \n" +
        "advertisements that You see on other websites, or selling such data to other\n" +
        "entities.</p>\n" +
        "<h2 id=\"other-tracking-technologies\">Other Tracking Technologies</h2>\n" +
        "<p>The Service uses &quot;Local Storage&quot; to store Your settings and saved sheets.\n" +
        "This data is not transmitted to the Service except when You opt to publish\n" +
        "content, at which point the saved sheet data is transmitted to the Service\n" +
        "and made public. Different Browsers handle Local Storage differently. Most\n" +
        "Browsers will persist Local Storage across multiple browsing sessions. Some\n" +
        "Browsers may decline to do so.</p>\n" +
        "<p>As with Cookies, any Advertising Partners may use other tracking\n" +
        "technologies, such as Local Storage, session storage, tracking pixels,\n" +
        "any other methods, or a combination of methods to attempt to associate \n" +
        "multiple Browser sessions to a single user.</p>\n" +
        "<p>Please note that if Your Browser downloads and executes a script from our \n" +
        "Advertising Partners, any behavior of that script is outside the control\n" +
        "of the Service. Furthermore, the exact behavior of your Browser as it pertains\n" +
        "to any of those technologies is outside of the control of the Service as well\n" +
        "as Advertising Partners.</p>\n" +
        "<h2 id=\"for-eu-users-only\">For EU Users Only</h2>\n" +
        "<p>When you use the Service, Advertising Partners may access information provided by Your Browser and information about Your interests from other sources to customize advertising or other purposes, should you consent to such. You will be prompted for Your consent to share data with all or some of these Advertising Partners upon your first visit. You revisit or change these choices later from the &quot;Update consent preferences&quot; link on the page.</p>\n" +
        "<h2 id=\"for-california-users-only\">For California Users Only</h2>\n" +
        "<p>When you use the Service, Advertising Partners may access information provided by Your Browser and information about Your interests from other sources to customize advertising or other purposes, should you consent to such. You can manage this consent by clicking the &quot;Do Not Sell My Personal Information&quot; link on the page.</p>\n" +
        "<h2 id=\"advertising-partners\">Advertising Partners</h2>\n" +
        "<p>Our Advertising is provided via NitroPay (www.nitropay.com). NitroPay may \n" +
        "display Advertising from other providers. You may view the full list of\n" +
        "potential Advertising Partners at <a href=\"https://xivgear.app/ads.txt\">https://xivgear.app/ads.txt</a>.</p>\n" +
        "<p>Please note that should Your Browser execute any Advertising Partner scripts,\n" +
        "and should those scripts collect any data for transmission to the Avertising\n" +
        "Partner, the data is sent directly from Your Browser to the Advertising\n" +
        "Partner. The data is never sent to nor stored by the Service. As such, the\n" +
        "Service cannot assist You in retrieving or removing any data pertaining to\n" +
        "You from any Advertising Parnters.</p>\n";
}

class PrivacyPolicyModal extends BaseModal {
    constructor() {
        super();
        this.headerText = 'Privacy Policy';
        const element = document.createElement('div');
        element.innerHTML = getPrivacyHtml();
        this.contentArea.appendChild(element);
        this.contentArea.style.textAlign = 'left';
        this.contentArea.style.padding = '25px';
        this.inner.style.maxWidth = '1200px';
        this.inner.style.maxHeight = '900px';
        this.addCloseButton();
    }
}

function showPrivacyPolicyModal() {
    console.log('Opening privacy policy modal.');
    recordEvent('openPrivacyPolicy');
    new PrivacyPolicyModal().attachAndShow();
}

customElements.define('privacy-policy-modal', PrivacyPolicyModal);
