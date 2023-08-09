import {JobName} from "../xivconstants";
import {XivApiJobData} from "../components";

let jobData: XivApiJobData[];
const jobIconMap = new Map<JobName, string>();

async function ensureJobDataLoaded() {
    if (jobData !== undefined) {
        return;
    }
    await fetch("https://xivapi.com/ClassJob?columns=Name,Abbreviation,ID,Icon")
        .then(response => response.json())
        .then(response => response['results'] as XivApiJobData[])
        .then(data => jobData = data);
    for (let jobDatum of jobData) {
        jobIconMap.set(jobDatum.Abbreviation as JobName, jobDatum.Icon);
    }
}

export class JobIcon extends HTMLImageElement {
    constructor(job: JobName) {
        super();
        ensureJobDataLoaded().then(() => this.src = "https://xivapi.com/" + jobIconMap.get(job));
    }
}

customElements.define("ffxiv-job-icon", JobIcon, {extends: "img"});
