import { FuryType, MNKGaugeState } from './mnk_types';

export class MNKGauge {
    // Initialized to assume you pressed Meditate before combat
    chakra: number = 5;
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
        return this;
    }
}
