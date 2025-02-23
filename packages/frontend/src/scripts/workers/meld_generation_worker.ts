import {
    EquippedItem,
    EquipSlotKey,
    MicroSetExport,
    MicroSlotExport,
    RelicStatsExport
} from "@xivgear/xivmath/geartypes";
import {GearPlanSheet} from "@xivgear/core/sheet";
import {GearsetGenerator} from "@xivgear/core/solving/gearset_generation";
import {DEBUG_FINAL_REGISTRY, JobInfo, WorkerBehavior} from "./worker_common";
import {CharacterGearSet} from "@xivgear/core/gear";
import {GearsetGenerationRequest, JobContext} from "@xivgear/core/workers/worker_types";
import {setToMicroExport} from "@xivgear/core/workers/worker_utils";

export type GearsetGenerationJobContext = JobContext<GearsetGenerationRequest, MicroSetExport[], 'done'>;

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
            const exports: MicroSetExport[] = [];
            sets.forEach(set => {
                exports.push(setToMicroExport(set));
            });
            this.postUpdate(exports);
        };

        setGenerator.getMeldPossibilitiesForGearset(gearsetGenSettings, genCallback);

        this.postResult(
            'done'
        );
    }
}
