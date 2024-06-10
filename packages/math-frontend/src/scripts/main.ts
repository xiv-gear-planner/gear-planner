import {processNav} from "./nav_hash";
import {earlyUiSetup, initialLoad, initTopMenu} from "./base_ui";

// Main entry point for actual browsers
document.addEventListener("DOMContentLoaded", () => {
    earlyUiSetup();
    initTopMenu();
    // SPA stuff
    addEventListener("popstate", processNav);
    // Initial page load behavior
    initialLoad();
});
