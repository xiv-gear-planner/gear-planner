import {processRawMateriaInfo, XivApiFoodInfo, XivApiGearInfo} from "./gear";
import {JobName, MATERIA_LEVEL_MAX_NORMAL, SupportedLevel} from "./xivconstants";
import {GearItem, JobMultipliers, Materia} from "./geartypes";
import {xivApiGet} from "./external/xivapi";

export class DataManager {
    allItems: XivApiGearInfo[];
    allMateria: Materia[];
    allFoodItems: XivApiFoodInfo[];

    minIlvl = 570;
    maxIlvl = 999;
    minIlvlFood = 540;
    maxIlvlFood = 999;
    classJob: JobName = 'WHM'
    level: SupportedLevel = 90;

    jobMultipliers: Map<JobName, JobMultipliers>;

    itemById(id: number): (GearItem | undefined) {
        return this.allItems.find(item => item.id === id);
    }

    materiaById(id: number): (Materia | undefined) {
        if (id < 0) {
            return undefined;
        }
        return this.allMateria.find(item => item.id === id);
    }

    foodById(id: number) {
        return this.allFoodItems.find(food => food.id === id);
    }

    loadData() {
        console.log("loading items");
        // Gear Items
        const itemsPromise = xivApiGet({
            requestType: 'search',
            sheet: 'Item',
            columns: ['ID', 'IconHD', 'Name', 'LevelItem', 'Stats', 'EquipSlotCategory', 'MateriaSlotCount', 'IsAdvancedMeldingPermitted', 'DamageMag', 'DamagePhys'] as const,
            // EquipSlotCategory! => EquipSlotCategory is not null => filters out now-useless belts
            filters: [`LevelItem>=${this.minIlvl}`, `LevelItem<=${this.maxIlvl}`, `ClassJobCategory.${this.classJob}=1`, 'EquipSlotCategory!'],
        })
            // const itemsPromise = fetch(`https://xivapi.com/search?indexes=Item&filters=LevelItem%3E=${this.minIlvl},LevelItem%3C=${this.maxIlvl},ClassJobCategory.${this.classJob}=1&columns=ID,IconHD,Name,LevelItem,Stats,EquipSlotCategory,MateriaSlotCount,IsAdvancedMeldingPermitted,DamageMag,DamagePhys`)
            .then((data) => {
                if (data) {
                    console.log(`Got ${data.Results.length} Items`);
                    return data.Results;
                }
                else {
                    console.error(`Got No Items!`);
                }
            }).then((rawItems) => {
                this.allItems = rawItems.map(i => new XivApiGearInfo(i));
                this.allItems.forEach(item => item.fixSubstatCap(this.allItems));
                // TODO: put up error
            }, (e) => console.error(e));

        // Materia
        const matCols = ['ID', 'Value*', 'BaseParam.ID'];
        for (let i = 0; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
            matCols.push(`Item${i}.Name`);
            // TODO: normal or HD icon?
            matCols.push(`Item${i}.IconHD`);
            matCols.push(`Item${i}.ID`);
        }
        const materiaPromise = xivApiGet({
            requestType: 'list',
            sheet: 'Materia',
            columns: matCols,
            pageLimit: 1
        })
            // const materiaPromise = fetch(`https://xivapi.com/Materia?columns=${matCols.join(',')}`)
            .then((data) => {
                if (data) {
                    console.log(`Got ${data.Results.length} Materia Types`)
                    this.allMateria = data.Results
                        .filter(i => i['Value' + (MATERIA_LEVEL_MAX_NORMAL - 1)])
                        .flatMap(item => {
                            return processRawMateriaInfo(item);
                        });
                    console.log(`Processed ${this.allMateria.length} total Materia items`);
                }
                else {
                    console.error('Got No Materia!');
                }
            }, e => {
                console.error(e);
            });
        const foodPromise = xivApiGet({
            requestType: 'search',
            sheet: 'Item',
            filters: ['ItemKind.ID=5', 'ItemSearchCategory.ID=45', `LevelItem%3E=${this.minIlvlFood}`, `LevelItem%3C=${this.maxIlvlFood}`],
            columns: ['ID', 'IconHD', 'Name', 'LevelItem', 'Bonuses'] as const
        })
            // const foodPromise = fetch(`https://xivapi.com/search?indexes=Item&filters=ItemKind.ID=5,ItemSearchCategory.ID=45,LevelItem%3E=${this.minIlvlFood},LevelItem%3C=${this.maxIlvlFood}&columns=ID,IconHD,Name,LevelItem,Bonuses`)
            .then((data) => {
                console.log(`Got ${data.Results.length} Food Items`);
                return data.Results;
            })
            .then((rawFoods) => rawFoods.map(i => new XivApiFoodInfo(i)))
            .then((processedFoods) => processedFoods.filter(food => Object.keys(food.bonuses).length > 1))
            .then((foods) => this.allFoodItems = foods,
                e => console.error(e));
        const jobsPromise = xivApiGet({
            requestType: "list",
            sheet: "ClassJob",
            columns: ['Abbreviation', 'ModifierDexterity', 'ModifierIntelligence', 'ModifierMind', 'ModifierStrength', 'ModifierVitaliry'] as const
        })
            .then(data => {
                console.log(`Got ${data.Results.length} Jobs`);
                return data.Results;
            })
            .then(rawJobs => {
                this.jobMultipliers = new Map<JobName, JobMultipliers>();
                for (let rawJob of rawJobs) {
                    this.jobMultipliers.set(rawJob['Abbreviation'], {
                        dexterity: rawJob.ModifierDexterity,
                        intelligence: rawJob.ModifierIntelligence,
                        mind: rawJob.ModifierMind,
                        strength: rawJob.ModifierStrength
                    })
                }
            });
        return Promise.all([itemsPromise, materiaPromise, foodPromise, jobsPromise]);
    }

    multipliersForJob(job: JobName) {
        if (!this.jobMultipliers) {
            throw Error("You must wait for loadData() before calling this method");
        }
        const multi = this.jobMultipliers.get(job);
        if (!multi) {
            throw Error(`No data for job ${job}`)
        }
        return multi;
    }
}
