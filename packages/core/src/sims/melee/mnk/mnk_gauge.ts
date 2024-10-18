import { FuryType, MNKGaugeState } from './mnk_types';

export class MNKGauge {
    chakra: number = 0;
    // TODO add brotherhood support
    gainChakra(chakra: number) {
        this.chakra += chakra;
    }

    opoFury: number = 0;
    raptorFury: number = 0;
    coeurlFury: number = 0;

    lunarNadi: number = 0;
    solarNadi: number = 0;

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
