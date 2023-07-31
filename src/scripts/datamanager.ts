import {GearItem, Materia, processRawMateriaInfo, XivApiGearInfo} from "./gear";
import {JobName, MATERIA_LEVEL_MAX_NORMAL, RaceName, SupportedLevel} from "./xivconstants";

export class DataManager {
    items: XivApiGearInfo[];
    materiaTypes: Materia[];

    minIlvl = 640;
    maxIlvl = 665;
    classJob : JobName = 'WHM'
    race : RaceName | null = null;
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

    loadData() {
        console.log("loading items");
        const itemsPromise = fetch(`https://xivapi.com/search?indexes=Item&filters=LevelItem%3E=${this.minIlvl},LevelItem%3C=${this.maxIlvl},ClassJobCategory.${this.classJob}=1&columns=ID,IconHD,Name,LevelItem,Stats,EquipSlotCategory,MateriaSlotCount,IsAdvancedMeldingPermitted,DamageMag,DamagePhys`)
            .then((response) => {
                return response.json()
            }, (reason) => {
                console.error(reason)
            }).then((data) => {
                console.log(`Got ${data['Results'].length} Items`)
                return data['Results'];
            }).then((rawItems) => {
                this.items = rawItems.map(i => new XivApiGearInfo(i));
                // this.items.forEach(item => {
                //     console.log(item.name)
                //     this.appendChild(new GearItemDisplay(item as XivApiGearInfo));
                // })
            });
        const matCols = ['ID', 'Value*', 'BaseParam.ID'];
        for (let i = 0; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
            matCols.push(`Item${i}.Name`);
            // TODO: normal or HD icon?
            matCols.push(`Item${i}.IconHD`);
            matCols.push(`Item${i}.ID`);
        }
        const materiaPromise = fetch(`https://xivapi.com/Materia?columns=${matCols.join(',')}`)
            .then((response) => {
                return response.json();
            }, (reason) => {
                console.error(reason)
            }).then((data) => {
                console.log(`Got ${data['Results'].length} Materia Types`)
                return data['Results'];
            }).then((rawMatData) => {
                // Filter to only things that are currently relevant
                this.materiaTypes = rawMatData.filter(i => i['Value' + (MATERIA_LEVEL_MAX_NORMAL - 1)]).flatMap(item => {
                    const materias = processRawMateriaInfo(item);
                    return materias;
                });
                console.log(`Processed ${this.materiaTypes.length} total Materia items`);
            })
        return Promise.all([itemsPromise, materiaPromise]);
    }
}
