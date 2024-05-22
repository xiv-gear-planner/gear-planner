import {registerDefaultSims} from "./sims/default_sims";
import {installDoubleClickHandler} from "./util/stop_double_click";
import {processHash} from "./nav_hash";
import {earlyUiSetup, initialLoad} from "./base_ui";

// Main entry point for actual browsers
document.addEventListener("DOMContentLoaded", () => {
    // iosPolyfill();
    registerDefaultSims();
    earlyUiSetup();
    // TODO: this causes the server component to throw an error since addEventListener is not defined,
    // but this may actually be fine to take advantage of in some way, since we don't *want* unnecessary
    // stuff to happen.
    addEventListener("hashchange", processHash);
    // Stop double click selection
    installDoubleClickHandler();
    // Initial page load behavior
    initialLoad();
});
