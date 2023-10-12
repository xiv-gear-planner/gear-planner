import { AttackType } from '../../geartypes'

export interface ComboInfo
{
    from: number
    duration: number
    potency: number
}

export interface Action
{
    id: number
    type: AttackType
    potency?: number
    cooldown?: number

    combo?: ComboInfo
    startsCombo?: boolean
    breaksCombo?: boolean

    multihit?: boolean
    falloff?: number
}
