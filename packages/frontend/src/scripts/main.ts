import {processHashLegacy, processNav} from "./nav_hash";
import {earlyUiSetup, initialLoad, initTopMenu} from "./base_ui";
import {registerDefaultSims} from "@xivgear/core/sims/default_sims";
import {installFallbackPrivacyArea} from "./components/ads";
import {installDoubleClickHandler} from "@xivgear/common-ui/util/stop_double_click";

// Main entry point for actual browsers
document.addEventListener("DOMContentLoaded", () => {
    // iosPolyfill();
    registerDefaultSims();
    earlyUiSetup();
    initTopMenu();
    // SPA stuff
    addEventListener("popstate", processNav);
    addEventListener("hashchange", processHashLegacy);
    // Stop double click selection
    installDoubleClickHandler();
    // Initial page load behavior
    initialLoad();
    installFallbackPrivacyArea();
});
