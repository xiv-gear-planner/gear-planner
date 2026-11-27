import {processNav} from "./nav_hash";
import {earlyUiSetup, initialLoad, initSideMenu} from "./base_ui";
import {registerFormulae} from "./mathpage/formulae";

// Main entry point for actual browsers
document.addEventListener("DOMContentLoaded", () => {
    earlyUiSetup();
    initSideMenu();
    // SPA stuff
    addEventListener("popstate", processNav);
    // Initial page load behavior
    registerFormulae();
    initialLoad();
});
