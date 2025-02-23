import {SetExport} from "@xivgear/xivmath/geartypes";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerator} from "@xivgear/core/solving/gearset_generation";
import {DEBUG_FINAL_REGISTRY, JobInfo, WorkerBehavior} from "./worker_common";
import {CharacterGearSet} from "@xivgear/core/gear";
import {GearsetGenerationRequest, JobContext} from "@xivgear/core/workers/worker_types";

export type GearsetGenerationJobContext = JobContext<GearsetGenerationRequest, SetExport[], 'done'>;

export class GearsetGenerationWorker extends WorkerBehavior<GearsetGenerationJobContext> {

    sheet: GearPlanSheet;

    constructor(sheet: GearPlanSheet, info: JobInfo) {
        super(info);
        this.sheet = sheet;
        DEBUG_FINAL_REGISTRY.register(this, "GearsetGenerationWorker");
    }

    override async execute(request: GearsetGenerationRequest) {

        const settings = request.data;
        const gearset = this.sheet.importGearSet(settings.gearset);
        const gearsetGenSettings = {
            ...settings,
            gearset,
        };

        const setGenerator = new GearsetGenerator(this.sheet, gearsetGenSettings);
        const genCallback: ((sets: CharacterGearSet[]) => void) = (sets: CharacterGearSet[]) => {
            const exportedSets: SetExport[] = sets.map(set => this.sheet.exportGearSet(set));
            this.postUpdate(exportedSets);
        };
        setGenerator.getMeldPossibilitiesForGearset(gearsetGenSettings, genCallback);
        this.postResult('done');
    }
}
