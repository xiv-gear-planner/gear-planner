import {flp} from "./xivmath";

export function eurekaEleMult(eleVal: number, eleResist: number) {
    return Math.min(4, flp(3, eleVal / eleResist));
}
