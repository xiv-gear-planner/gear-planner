import {installDoubleClickHandler} from "@xivgear/common-ui/util/stop_double_click";
import {processNav, processHashLegacy} from "./nav_hash";
import {earlyUiSetup, initialLoad, initTopMenu} from "./base_ui";
import { registerDefaultSims } from "@xivgear/core/sims/default_sims";

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
