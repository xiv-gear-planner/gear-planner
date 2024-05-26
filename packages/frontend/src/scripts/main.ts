import {registerDefaultSims} from "./sims/default_sims";
import {installDoubleClickHandler} from "./util/stop_double_click";
import {processNav, processHashLegacy} from "./nav_hash";
import {earlyUiSetup, initialLoad, initTopMenu} from "./base_ui";

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
});
