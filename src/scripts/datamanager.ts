import {processRawMateriaInfo, XivApiFoodInfo, XivApiGearInfo} from "./gear";
import {JobName, MATERIA_LEVEL_MAX_NORMAL, RaceName, SupportedLevel} from "./xivconstants";
import {GearItem, Materia} from "./geartypes";
import {getAll, searchAll} from "./external/xivapi";

export class DataManager {
    items: XivApiGearInfo[];
    materiaTypes: Materia[];
    foodItems: XivApiFoodInfo[];

    minIlvl = 640;
    maxIlvl = 999;
    minIlvlFood = 610;
    maxIlvlFood = 999;
    classJob: JobName = 'WHM'
    race: RaceName | null = null;
    level: SupportedLevel = 90;

    itemById(id: number): (GearItem | undefined) {
        return this.items.find(item => item.id === id);
    }

    materiaById(id: number): (Materia | undefined) {
        if (id < 0) {
            return undefined;
        }
        return this.materiaTypes.find(item => item.id === id);
    }

    foodById(id: number) {
        return this.foodItems.find(food => food.id === id);
    }

    loadData() {
        console.log("loading items");
        const itemsPromise = searchAll('Item', [`LevelItem>=${this.minIlvl}`, `LevelItem<=${this.maxIlvl}`, `ClassJobCategory.${this.classJob}=1`], ['ID', 'IconHD', 'Name', 'LevelItem', 'Stats', 'EquipSlotCategory', 'MateriaSlotCount', 'IsAdvancedMeldingPermitted', 'DamageMag', 'DamagePhys'])
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
                this.items = rawItems.map(i => new XivApiGearInfo(i));
                // TODO: put up error
            }, (e) => console.error(e));
        const matCols = ['ID', 'Value*', 'BaseParam.ID'];
        for (let i = 0; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
            matCols.push(`Item${i}.Name`);
            // TODO: normal or HD icon?
            matCols.push(`Item${i}.IconHD`);
            matCols.push(`Item${i}.ID`);
        }
        const materiaPromise = getAll('Materia', [], matCols)
            // const materiaPromise = fetch(`https://xivapi.com/Materia?columns=${matCols.join(',')}`)
            .then((data) => {
                if (data) {
                    console.log(`Got ${data.Results.length} Materia Types`)
                    this.materiaTypes = data.Results
                        .filter(i => i['Value' + (MATERIA_LEVEL_MAX_NORMAL - 1)])
                        .flatMap(item => {
                            return processRawMateriaInfo(item);
                        });
                    console.log(`Processed ${this.materiaTypes.length} total Materia items`);
                }
                else {
                    console.error('Got No Materia!');
                }
            }, e => {
                console.error(e);
            });
        const foodPromise = searchAll('Item',
            ['ItemKind.ID=5', 'ItemSearchCategory.ID=45', `LevelItem%3E=${this.minIlvlFood}`, `LevelItem%3C=${this.maxIlvlFood}`],
            ['ID', 'IconHD', 'Name', 'LevelItem', 'Bonuses'])
            // const foodPromise = fetch(`https://xivapi.com/search?indexes=Item&filters=ItemKind.ID=5,ItemSearchCategory.ID=45,LevelItem%3E=${this.minIlvlFood},LevelItem%3C=${this.maxIlvlFood}&columns=ID,IconHD,Name,LevelItem,Bonuses`)
            .then((data) => {
                console.log(`Got ${data.Results.length} Food Items`);
                return data.Results;
            })
            .then((rawFoods) => rawFoods.map(i => new XivApiFoodInfo(i)))
            .then((processedFoods) => processedFoods.filter(food => Object.keys(food.bonuses).length > 1))
            .then((foods) => this.foodItems = foods,
                e => console.error(e));
        return Promise.all([itemsPromise, materiaPromise, foodPromise]);
    }
}
