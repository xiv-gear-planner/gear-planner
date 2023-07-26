// import '@webcomponents/webcomponentsjs/webcomponents-bundle.js'
// import '@webcomponents/webcomponentsjs/custom-elements-es5-adapter.js'

import {GearSet} from "./geartypes";

class GearPlanRow extends HTMLElement {
    constructor() {
        super();
        var header = document.createElement("h3");
        header.textContent = "foo"
        this.appendChild(header)
        console.log("Constructed")
    }

    // connectedCallback() {
    //     console.log("Connected")
    //     this.appendChild(document.createElement("h2"))
    // }
}

customElements.define("gear-plan-row", GearPlanRow)

document.addEventListener("DOMContentLoaded", () => {
    console.log("Loaded")
    document.getElementById("gear-plan-table").appendChild(new GearPlanRow())
})

class GearPlanner {

    sets: GearSet[];

    minIlvl = 640;
    maxIlvl = 665;
    classJob = 'WHM'

    loadItems() {
        console.log("loading items (not really)")
        fetch(`https://xivapi.com/search?indexes=Item&filters=LevelItem%3E=${this.minIlvl},LevelItem%3C=${this.maxIlvl},ClassJobCategory.${this.classJob}=1&columns=ID,Icon,Name,Stats`)
            .then((response) => {
                return response.json()
            }, (reason) => {
                console.error(reason)
            }).then((data) => {
            console.log(data)
            console.log(`Got ${data['Results'].length} Items`)
        })
    }
}

const planner = new GearPlanner()
document['planner'] = planner
