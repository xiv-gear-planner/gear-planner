import { Action } from './action'

export const ACTIONS: Record<string, Action> = {
    ATTACK: {
        id: 7,
        type: 'Auto-attack',
        potency: 90,
    },
    SHOT: {
        id: 8,
        type: 'Auto-attack',
        potency: 80,
    },
}
