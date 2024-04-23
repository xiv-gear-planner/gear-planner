import {JobName} from "xivmath/xivconstants";
import {XivApiJobData} from "../components";

let jobData: XivApiJobData[];
const jobIconMap = new Map<JobName, string>();

// TODO: can this be consolidated with other job loading stuff in DataManager?
async function ensureJobDataLoaded() {
    if (jobData !== undefined) {
        return;
    }
    await fetch("https://xivapi.com/ClassJob?columns=Name,Abbreviation,ID,Icon")
        .then(response => response.json())
        .then(response => response['Results'] as XivApiJobData[])
        .then(data => jobData = data);
    for (let jobDatum of jobData) {
        jobIconMap.set(jobDatum.Abbreviation as JobName, jobDatum.Icon);
    }
}

export class JobIcon extends HTMLImageElement {
    constructor(job: JobName) {
        super();
        this.classList.add('ffxiv-job-icon');
        ensureJobDataLoaded().then(() => this.src = "https://xivapi.com/" + jobIconMap.get(job));
    }
}

customElements.define("ffxiv-job-icon", JobIcon, {extends: "img"});
