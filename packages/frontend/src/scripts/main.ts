import {processHashLegacy, processNav} from "./nav_hash";
import {earlyUiSetup, initialLoad, initTopMenu} from "./base_ui";
import {registerDefaultSims} from "@xivgear/core/sims/default_sims";
import {installFallbackPrivacyArea} from "./components/ads";
import {installDoubleClickHandler} from "@xivgear/common-ui/util/stop_double_click";
import {ACCOUNT_STATE_TRACKER} from "./account/account_state";
import {setupAccountUi} from "./account/components/account_components";
import {setupUserDataSync} from "./account/user_data";
import {startSizeAnalytics} from "./analytics/analytics_helpers";

// Main entry point for actual browsers
document.addEventListener("DOMContentLoaded", () => {
    // Sim configuration
    registerDefaultSims();

    // Early UI stuff
    earlyUiSetup();
    initTopMenu();

    // SPA stuff
    // Handles use of the browser back/forward buttons
    addEventListener("popstate", processNav);
    // Handles changes in old-style hashes (still needed for some purposes where the data is too large to fit in query params)
    addEventListener("hashchange", processHashLegacy);

    // Stop double click selection
    installDoubleClickHandler();
    // Initial page load behavior
    initialLoad();

    // Normally, the "Privacy" link is in the left-hand ad area. But if there is no ad showing (because the screen is
    // too small, or ads are blocked), this acts as a fallback area to hold the privacy link.
    installFallbackPrivacyArea();

    ACCOUNT_STATE_TRACKER.init();
    setupUserDataSync();
    setupAccountUi();
    startSizeAnalytics();
});
