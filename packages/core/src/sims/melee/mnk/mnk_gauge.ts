import { FuryType, MNKGaugeState } from './mnk_types';

export class MNKGauge {
    chakra: number = 0;
    gainChakra(chakra: number) {
        // TODO ideally this would cap chakra at 5/10 but chakra is currently implemented probabilistically it is nice that it overcaps
        this.chakra += chakra;
    }

    opoFury: number = 0;
    raptorFury: number = 0;
    coeurlFury: number = 0;

    lunarNadi: number = 0;
    solarNadi: number = 0;

    public get emptyNadis(): boolean {
        return !(this.lunarNadi || this.solarNadi);
    }

    beastChakra: FuryType[] = [];

    getGaugeState(): MNKGaugeState {
        return {
            chakra: this.chakra,
            opoFury: this.opoFury,
            raptorFury: this.raptorFury,
            coeurlFury: this.coeurlFury,
            lunarNadi: this.lunarNadi,
            solarNadi: this.solarNadi,
            beastChakra: this.beastChakra,
        };
    }
}
