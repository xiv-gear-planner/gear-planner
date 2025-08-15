import {recordEvent} from "@xivgear/common-ui/analytics/analytics";
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

    constructor(public readonly id: string, outerSize: AdContainerSize, condition: DisplayCondition) {
        this.adContainer = makeFixedArea(id, outerSize[0], outerSize[1]);
        this.adSize = outerSize;
        this.adSizes = AdSizes.filter(size => size[0] <= outerSize[0] && size[1] <= outerSize[1]);
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

const AdSizes = [
    [300, 600],
    [336, 280],
    [320, 480],
    [160, 600],
    [300, 250],
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
] as const;
type AdContainerSize = typeof AdContainerSizes[number];
// const foo: AdContainerSize = [300, 250];

let idCounter = 1;

const currentAds: ManagedAd[] = [];
const extraLinksHolderInner = document.createElement('div');
extraLinksHolderInner.style.display = 'content';

window.addEventListener('resize', recheckAds);

window.currentAds = currentAds;

function recheckAds() {
    setTimeout(() => {

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
            window.__cmp?.('addConsentLink');
            window.__uspapi?.('addLink', 1);
            const showing = currentAds.filter(ad => ad.showing);
            if (showing.length > 0) {
                recordEvent('shownAds', {shownAds: showing.map(ad => ad.id).join(","), count: showing.length});
            }
            else {
                recordEvent('shownAds', {shownAds: 'none', count: 0});
            }
        }
        else {
            console.debug('recheckAds: not enabled');
        }
        if (oneAdShown) {
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

export function insertAds(element: HTMLElement) {

    setTimeout(
        () => {
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
                        const children = element.querySelectorAll('.weapon-table, .left-side-gear-table, .right-side-gear-table, .food-items-table');
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

                    function adCondition(size: AdContainerSize, previous: DisplayCondition[] = []): DisplayCondition {
                        return (w, h) => {
                            for (const prev of previous) {
                                if (prev(w, h)) {
                                    return false;
                                }
                            }
                            return horizFit(w, size[0]) && h >= size[1] + Y_PADDING;
                        };
                    }

                    function adConditions<X extends readonly AdContainerSize[]>(sizes: X): { [I in keyof X]: DisplayCondition } {
                        const out: DisplayCondition[] = [];
                        sizes.forEach(size => {
                            const newCond = adCondition(size, [...out]);
                            out.push(newCond);
                        });
                        return out as { [I in keyof X]: DisplayCondition };
                    }

                    const [
                        sideXWideCond,
                        sideXWideShortCond,
                        sideWideCond,
                        sideWideShortCond,
                        sideNarrowCond,
                    ] = adConditions(AdContainerSizes);

                    {
                        const size: AdContainerSize = [336, 600];
                        const adAreaLeftWide = new ManagedAd('float-area-xwide-left', size, sideXWideCond);
                        {
                            const outer = adAreaLeftWide.adContainer.outer;
                            const middle = adAreaLeftWide.adContainer.middle;
                            outer.style.left = '0';
                            middle.style.marginLeft = '-5px';
                            middle.style.borderRadius = '0 10px 0 0';
                        }
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-xwide-right', size, sideXWideCond);
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
                        const size: AdContainerSize = [336, 280];
                        const adAreaLeftWide = new ManagedAd('float-area-xwide-short-left', size, sideXWideShortCond);
                        {
                            const outer = adAreaLeftWide.adContainer.outer;
                            const middle = adAreaLeftWide.adContainer.middle;
                            outer.style.left = '0';
                            middle.style.marginLeft = '-5px';
                            middle.style.borderRadius = '0 10px 0 0';
                        }
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-xwide-short-right', size, sideXWideShortCond);
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
                        const size: AdContainerSize = [300, 600];
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
                        const size: AdContainerSize = [300, 250];
                        const adAreaLeftWide = new ManagedAd('float-area-wide-short-left', size, sideWideShortCond);
                        {
                            const outer = adAreaLeftWide.adContainer.outer;
                            const middle = adAreaLeftWide.adContainer.middle;
                            outer.style.left = '0';
                            middle.style.marginLeft = '-5px';
                            middle.style.borderRadius = '0 10px 0 0';
                        }
                        currentAds.push(adAreaLeftWide);

                        const adAreaRightWide = new ManagedAd('float-area-wide-short-right', size, sideWideShortCond);
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
                        const size: AdContainerSize = [160, 600];
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
            currentAds.forEach(ad => ad.showing = false);
            element.prepend(...currentAds.map(a => a.adContainer.outer));
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

function getPrivacyHtml(): string {
    return `<h1 id="privacy-policy">Privacy Policy</h1>
<p>Last updated July 1st, 2025. </p>
<h2 id="definitions">Definitions</h2>
<p>The &quot;Service&quot; refers to the collective services provided when
    you browse to or otherwise interact with the xivgear.app website.</p>
<p>&quot;Advertising Partner&quot; refers to any third party which provides, directly or
    indirectly, advertisements which your Browser may display, including providers
    such as advertising resellers.</p>
<p>&quot;Browser&quot; refers to a program, commonly referred to as a &quot;web browser&quot;, which
    acts as the graphical interface between You and the Service.</p>
<h2 id="information-we-collect-and-how-we-use-it">Information We Collect and How We Use It</h2>
<p>We may collect and store information in connection with Your use of the
    Service, including any information You, a web Browser, or any other
    client software acting on Your behalf transmits to the service. This
    includes all of the following:</p>
<ul>
    <li>Data provided when registering an account, or changing account details, including but not limited to,
        your email address(es)
    </li>
    <li>Data required for a functioning network connnection, including Your IP address</li>
    <li>Data voluntarily provided by Your Browser, including but not limited to
        Browser type, version, screen resolution, and referring URL (the page You
        were on when You clicked on a link to this Service). This may also include
        geolocation data.
    </li>
    <li>Additional analytics data, such as button clicks and page visit duration</li>
</ul>
<p>When registering an account or changing account details, you will be asked to provide
    certain Personally Identifiable Information including, but not limited to, an email address.
    This information is not used for any purpose outside of the management and use of your account.
    For example, The Service may send you an email to verify your email address, and your email address may
    be used to log in to the service.</p>
<p>Accounts are the only purpose for which your PII is used.
    You should not enter any Personally Identifiable Information into other parts of the website,
    as it will be indistinguishable from non-PII data.</p>
<p>If You use the Service to publish any content, then that content will be fully
    accessible to any member of the public. Publishing content is only performed
    when clicking a button containing the word &quot;Export&quot; or &quot;Share&quot; and
    subsequently choosing to generate a link to the content. Published content
    is not associated with an individual nor user account. That is, all published
    content is published anonymously.</p>
<h2 id="information-collected-by-advertising-partners">Information Collected By Advertising Partners</h2>
<p>Advertising partners may collect information about you or your browser. They may use that
    information to personalize Your experience and display relevant advertising.</p>
<h2 id="cookies">Cookies</h2>
<p>Cookies are a part of HTTP transactions, where a server can send the client
    a &quot;Cookie&quot;, which consists of a key (name), a value, and optionally data
    specifying which sites the Cookie is valid for. Upon subsequent visits to
    a website where that Cookie is valid, Your Browser may voluntarily send the
    Cookie&#39;s key and value back to the server. To understand how Your Browser
    stores Cookies on Your device, or decides when to send a Cookie back to a
    server, You should consult Your Browser&#39;s documentation. Your Browser may offer
    settings which will restrict which Cookies will be accepted. Cookies may be used
    to uniquely identify Your Browser, such as to allow You to remain logged into
    an account after closing Your Browser, or by advertisers to track You across
    multiple different web sites in order to build a profile of Your interests.</p>
<p>The Service itself uses cookies for two purposes. The first is to track certain privacy
    opt-outs. The second is to allow you to log in to your account. When you log in, a Cookie
    is provided to your browser which allows The Service to identify the account you are logged in with.</p>
<p>Pages from the Service which Your Browser displays may contain script tag
    which request that Your Browser additionally execute scripts from our
    Advertising Partners. Should Your Browser execute these scripts, our
    Advertising Partners may use Cookies or other tracking technologies (see
    below) to serve You customized advertising based on Your interactions with
    other websites, and to track Your interactions on this Service. Advertising
    partners may use this data for many purposes, including customizing
    advertisements that You see on other websites, or selling such data to other
    entities.</p>
<h2 id="other-tracking-technologies">Other Tracking Technologies</h2>
<p>The Service uses &quot;Local Storage&quot; to store Your settings and saved sheets.
    This data is not transmitted to the Service except:
<ul>
    <li>When You opt to publish content, at which point the saved sheet data is transmitted to the Service
        and made public.
    </li>
    <li>When You are logged into an account, in which case your settings, saved sheets, and any other local data may
        additionally be uploaded to The Service in order to allow you to have the same settings and data across
        different devices or browsers which are logged in to the same account. Note that logging out does not clear
        such information from Local Storage.
    </li>
</ul>
Different Browsers handle Local Storage differently. Most
Browsers will persist Local Storage across multiple browsing sessions. Some
Browsers may decline to do so.</p>
<p>As with Cookies, any Advertising Partners may use other tracking
    technologies, such as Local Storage, session storage, tracking pixels,
    any other methods, or a combination of methods to attempt to associate
    multiple Browser sessions to a single user.</p>
<p>Please note that if Your Browser downloads and executes a script from our
    Advertising Partners, any behavior of that script is outside the control
    of the Service. Furthermore, the exact behavior of your Browser as it pertains
    to any of those technologies is outside of the control of the Service as well
    as Advertising Partners.</p>
<h2 id="for-eu-users-only">For EU Users Only</h2>
<p>When you use the Service, Advertising Partners may access information provided by Your Browser and
    information about
    Your interests from other sources to customize advertising or other purposes, should you consent to such.
    You will be prompted for Your consent to share data with all or some of these Advertising Partners upon your first
    visit. You revisit or change these choices later from the &quot;Update consent preferences&quot; link on the page.
    Note that this link will only appear if it appears that you are visiting from a location within the European
    Union.</p>
<p>You can submit any requests via email at wdxiv [at] icloud dot com. Submitting a request for data retrieval
    or removal does not require you to create an account with the Service.</p>
<h2 id="for-california-users-only">For California Users Only</h2>
<p>The CCPA provides consumers located in the state of California with certain rights regarding their personal
    information and data. The following section describes those rights and explains how to exercise them.</p>
<p>When you use the Service, Advertising Partners may access information provided by Your Browser and
    information about Your interests from other sources to customize advertising or other purposes, should you consent
    to such. You can manage this consent by clicking the &quot;Do Not Sell My Personal Information&quot; link on the
    page. Note that this link will only appear if it appears that you are visiting from a location within
    California.</p>
<h3>Access to Specific Information and Data Portability Rights</h3>
<p>You have the right to request the the Service disclose certain information to you about our collection and
    use of your personal information over the past 12 months. However, please note that as some of the data is collected
    strictly by third parties, the Service may be unable to assist with requests for data removal or data
    portability. The Service also may be unable to assist with removal of data that is not associated with an account.
</p>
<p>While this information may also be available in this privacy policy, You have the right to request:</p>
<ul>
    <li>The categories of personal information we collected about you.</li>
    <li>The categories of sources for the personal information we collected about you.</li>
    <li>Our business or commercial purpose for collecting or selling that personal information.</li>
    <li>The categories of third parties with whom we share that personal information.</li>
    <li>The specific pieces of personal information we collected about you (also called data portability
        request)
    </li>
    <li>If we sold or disclose your personal information for a business purpose, two separate lists
        disclosing:
    </li>
    <li>Sales, identifying the personal information categories that each category of recipient purchased, and
    </li>
    <li>Disclosures for a business purpose, identifying the personal information categories that each category
        of recipient obtained
    </li>
</ul>
<h3>Non-Discrimination</h3>
<p>Should You choose to exercise your right to opt out, the Service will not discriminate against you in any
    way. You
    are still free to access the Service as you otherwise would. We will not:</p>
<ul>
    <li>Deny you goods or services.</li>
    <li>Charge you different prices or rates for goods or services, including through granting discounts or
        imposing penalties.
    </li>
    <li>Provide you a different level or quality of goods or services.</li>
    <li>Suggest that you may receive a different price or rate for goods or services or a different level of
        quality of goods or services.
    </li>
</ul>
<h3>Removal or Portability Requests</h3>
<p>You can submit any requests via email at wdxiv [at] icloud dot com. We cannot respond to your request or
    provide you with personal information if we cannot verify your identity or authority to make the request and confirm
    the personal information relates to you. Submitting a request for data retrieval or removal does not require you to
    create an account with the Service.</p>
<h3>Information We Collect</h3>
<p>The specific nature and purpose(s) of data collection is described elsewhere in this privacy policy.</p>
<h3>Use of Personal Information</h3>
<p>
    The Service uses Personal Information that you enter when creating an account or updating account information
    to provide you with an account. This account allows you to log in to The Service, which allows settings and other
    data to be synchronized across devices. This data is not intentionally shared with any third parties except as
    needed to provide functionality - for example, in order to send you an email using your provided email address,
    the email message, including your email address, must be sent to third-party email servers.
    You should be aware that we cannot guarantee that advertising scripts from partners will not be able to access
    this data. You should use the opt-out link on the page to instruct these third parties to not share your data.
</p>
<p>
    Third parties may collect and retain Your information, including Personal Information, for one or more of
    the following business purposes:
</p>
<ul>
    <li>To advertisements relevant to your interests, including targeted offers, as well as to provide targeted
        advertisements on other websites or services.
    </li>
    <li>As described to you when collecting your personal information or as otherwise set forth in the CCPA.
    </li>
    <li>To process requests for removal or portability.</li>
</ul>
<h3>Sharing Personal Information</h3>
<p>Data collected directly by the service for the purpose of providing user accounts is not shared with third
    parties who are unrelated to the development or maintenance of The Service, except as needed to provide
    functionality. For example, in order to send you an email using your provided email address,
    the email message, including your email address, must be sent to third-party email servers.</p>
<p>If you have not opted out of the sale of your personal information, then the Service or any of its partners
    may request that your Browser execute scripts from third parties, including scripts which may instruct your
    browser to send Personal Information to such third parties.</p>
<p>Categories of third parties which may collect such data through scripts include:</p>
<ul>
    <li>Third parties with whom we partner to provide advertisements.</li>
    <li>Contractors and service providers.</li>
    <li>Data aggregators.</li>
</ul>
<h2 id="advertising-partners">Advertising Partners</h2>
<p>Our Advertising is provided via NitroPay (www.nitropay.com). NitroPay may
    display Advertising from other providers. You may view the full list of
    potential Advertising Partners at <a href="https://xivgear.app/ads.txt">https://xivgear.app/ads.txt</a>.</p>
<p>Please note that should Your Browser execute any Advertising Partner scripts,
    and should those scripts collect any data for transmission to the Avertising
    Partner, the data is sent directly from Your Browser to the Advertising
    Partner. The data is never sent to nor stored by the Service. As such, the
    Service cannot assist You in retrieving or removing any data pertaining to
    You from any Advertising Parnters.</p>

<h2>Changes To This Policy</h2>
<p>We reserve the right to update or change our Privacy Policy at any time. You should check this Privacy Policy
    regularly. Your continued use of the Service after the policy is modified will constitute your
    acknowledgement and acceptance of the changes.</p>`;
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

export function showPrivacyPolicyModal() {
    console.log('Opening privacy policy modal.');
    recordEvent('openPrivacyPolicy');
    new PrivacyPolicyModal().attachAndShowTop();
}

customElements.define('privacy-policy-modal', PrivacyPolicyModal);
