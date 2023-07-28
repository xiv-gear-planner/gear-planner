// import '@webcomponents/webcomponentsjs/webcomponents-bundle.js'
// import '@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js'

// import {GearSet, XivApiGearInfo} from "./geartypes";

import {GearPlanSheet} from "./components";
import {DataManager} from "./datamanager";


// customElements.define("gear-plan-row", GearPlanRow)


const dataManager = new DataManager();
var editorArea = document.getElementById("editor-area");
const planner = new GearPlanSheet(dataManager, editorArea, "default", "Default Sheet");
document['planner'] = planner

async function initialLoad() {
    await dataManager.loadItems();
    console.log("Loaded Data")
    planner.loadData();
    document.getElementById("content-area").appendChild(planner)
}

function earlyUiSetup() {
    const devMenu = document.getElementById("top-menu-area");
    const header = document.createElement("span")
    header.textContent = "Dev Menu";
    devMenu.appendChild(header);
    const nukeButton = document.createElement("button");
    nukeButton.addEventListener('click', (ev) => {
        localStorage.clear();
        location.reload();
    })
    nukeButton.textContent = "Nuke Local Storage";
    devMenu.appendChild(nukeButton);
}

document.addEventListener("DOMContentLoaded", () => {
    earlyUiSetup();
    initialLoad();
})

