import {MicroSetExport} from "@xivgear/xivmath/geartypes";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerator} from "@xivgear/core/solving/gearset_generation";
import {DEBUG_FINAL_REGISTRY, JobInfo, WorkerBehavior} from "./worker_common";
import {GearsetGenerationRequest} from "@xivgear/core/workers/worker_types";
import {GearsetGenerationJobContext, GearsetGenerationStatusUpdate} from "@xivgear/core/solving/types";


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

        const genCallback: ((sets: MicroSetExport[]) => void) = (sets: MicroSetExport[]) => {
            const exports: MicroSetExport[] = [];
            sets.forEach(set => {
                exports.push(set);
            });
            this.postUpdate({
                type: "sets",
                sets: exports,
            });
        };

        const statusCallback = (update: Omit<GearsetGenerationStatusUpdate, "type">) => {
            this.postUpdate({
                ...update,
                type: "status",
            });
        };

        await setGenerator.getMeldPossibilitiesForGearset(gearsetGenSettings, genCallback, statusCallback);

        this.postResult(
            'done'
        );
    }
}
