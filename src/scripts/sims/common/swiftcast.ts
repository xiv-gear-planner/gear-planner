import {Ability, Buff, BuffController, OgcdAbility} from "../sim_types";

export const SwiftcastBuff: Buff = {
    duration: 10,
    effects: {},
    name: "Swiftcast",
    selfOnly: true,
    beforeAbility<X extends Ability>(controller: BuffController, ability: X): X | null {
        if (ability.type === 'gcd' && ability.cast >= 0) {
            controller.removeStatus(SwiftcastBuff);
            return {
                ...ability,
                cast: 0
            }
        }
        return null;
    }
}

export const Swiftcast: OgcdAbility = {
    activatesBuffs: [SwiftcastBuff],
    id: 7561,
    name: "Swiftcast",
    potency: null,
    type: "ogcd",
    attackType: 'Ability',
    animationLock: 0.6,
    cooldown: {
        time: 60
    }

}
