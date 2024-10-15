import { SetExport } from "@xivgear/xivmath/geartypes";
import { GearPlanSheet } from "@xivgear/core/sheet";
import { GearsetGenerator } from "@xivgear/core/solving/gearset_generation";
import { WorkerBehavior } from "./worker_common";
import { GearsetGenerationRequest, JobContext } from "./worker_pool";


export type GearsetGenerationJobContext = JobContext<GearsetGenerationRequest, never, SetExport[]>;

export class GearsetGenerationWorker extends WorkerBehavior<GearsetGenerationJobContext> {

    sheet: GearPlanSheet;
    constructor(sheet: GearPlanSheet) {
        super();
        this.sheet = sheet;
    }

    override async execute(request: GearsetGenerationRequest) {

        const settings = request.data;
        const gearset = this.sheet.importGearSet(settings.gearset);
        const gearsetGenSettings = {
            ...settings,
            gearset,
        };

        const setGenerator = new GearsetGenerator(this.sheet, gearsetGenSettings);
        const allGearsets = setGenerator.getMeldPossibilitiesForGearset(gearsetGenSettings);

        const setsToExport: SetExport[] = allGearsets.map(set => this.sheet.exportGearSet(set));

        this.postResult(setsToExport);
    }
}