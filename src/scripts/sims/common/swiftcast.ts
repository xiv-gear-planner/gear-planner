import {Ability, Buff, BuffController, OgcdAbility} from "../sim_types";

export const SwiftcastBuff: Buff = {
    // TODO: can this field be made optional for buffs that are never automatic?
    cooldown: 60,
    duration: 10,
    effects: {},
    // TODO
    job: 'WHM',
    name: "Swiftcast",
    selfOnly: true,
    startTime: 0,
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
