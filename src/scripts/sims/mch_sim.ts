import { CharacterGearSet } from '../gear'
import { ComputedSetStats } from '../geartypes'
import {SimResult, SimSettings, SimSpec, Simulation } from '../simulation'
import { applyDhCrit, baseDamage } from '../xivmath'
import { MCH_ACTIONS as ACTIONS, ALL_ACTIONS } from './actions'
import nerdamer from 'nerdamer'

// https://www.thebalanceffxiv.com/jobs/ranged/machinist/advanced-guide
const BASE_GCD = 2.5
const HC_GCD = 1.5
const BATTERY_PPG = 23.67
const BARREL_STABILIZER_HEAT = 50
const HEATED_COMBO_HEAT = 5
const HYPERCHARGE_HEAT_COST = 50
const HEAT_BLASTS_PER_HC = 5
const GCDS_PER_WF = 6

export interface MchSimResult extends SimResult {
    pps: number
}

export interface MchSettings extends SimSettings {
    // Buff toggles would be nice
}

export const mchSpec: SimSpec<MchSim, MchSettings> = {
    displayName: "MCH Sim",
    loadSavedSimInstance(exported: MchSettings) {
        return new MchSim(exported)
    },
    makeNewSimInstance(): MchSim {
        return new MchSim()
    },
    stub: "mch-sim",
    supportedJobs: ['MCH'],
}

export class MchSim implements Simulation<MchSimResult, MchSettings, MchSettings> {
    public displayName = "MCH Sim"
    public shortName = "mch-sim"
    public spec = mchSpec
    public settings

    constructor(settings?: MchSettings) {
        if (settings) {
            this.settings = settings
        }
    }

    exportSettings(): MchSettings {
        return Object.assign({}, this.settings)
    }

    public makeConfigInterface(settings: MchSettings) {
        const outerDiv = document.createElement("div")
        const checkboxesDiv = document.createElement("div")

        // TODO Add raid buff toggles here?

        outerDiv.appendChild(checkboxesDiv)
        return outerDiv
    }

    public async simulate(set: CharacterGearSet): Promise<MchSimResult> {
        return {
            mainDpsResult: this.damagePerCycle(set.computedStats) / 120,
            pps: this.potencyPerCycle(set.computedStats) / 120,
        }
    }

    // Total damage dealt in an average two minute cycle (infinite duration)
    private damagePerCycle(stats: ComputedSetStats): number {
        const gcd = stats.gcdPhys(BASE_GCD)

        // Damage from GCD rotation
        const gcdDamage = baseDamage(stats, this.gcdPotencyPerCycle(gcd), 'Weaponskill')

        // Damage from WF
        // TODO: DoT damage formula NYI (?)
        const wfDamage = baseDamage(stats, this.wildfirePotencyPerCycle(), 'Ability')

        // Damage from Reassemble
        const reassembleDamage = this.reassembleDamagePerCycle(stats)
    
        // Damage from other oGCDs
        const ogcdDamage = baseDamage(stats, this.ogcdPotencyPerCycle(), 'Ability')

        // Damage from autos
        // TODO: Auto damage formula NYI (?)
        const autoDamage = baseDamage(stats, this.autoPotencyPerCycle(), 'Auto-attack')

        return applyDhCrit(gcdDamage + ogcdDamage + autoDamage, stats)
            + wfDamage
            + reassembleDamage
    }

    // Total potency dealt in an average two minute cycle (infinite duration)
    private potencyPerCycle(stats: ComputedSetStats): number {
        const gcd = stats.gcdPhys(BASE_GCD)

        return this.gcdPotencyPerCycle(gcd)
            + this.wildfirePotencyPerCycle()
            + this.ogcdPotencyPerCycle()
            + this.autoPotencyPerCycle()
    }

    // Returns the potency generated over 2 minutes by autos
    private autoPotencyPerCycle(): number {
        return ALL_ACTIONS.SHOT.potency * (120 / 3)
    }

    // Returns the potency generated over 2 minutes by WF
    private wildfirePotencyPerCycle(): number {
        const wildfirePotency = GCDS_PER_WF * ACTIONS.WILDFIRE.potency
        return wildfirePotency
    }

    // Returns the potency generated over 2 minutes by non-WF / non-reassemble oGCDs
    private ogcdPotencyPerCycle(): number {
        const gaussRoundPotency = (120 / ACTIONS.GAUSS_ROUND.cooldown) * ACTIONS.GAUSS_ROUND.potency
        const ricochetPotency = (120 / ACTIONS.RICOCHET.cooldown) * ACTIONS.RICOCHET.potency
    
        return gaussRoundPotency + ricochetPotency
    }

    // Returns the potency generated over 2 minutes by GCDs
    private gcdPotencyPerCycle(gcd: number): number {
        const fillerPotency = (
            ACTIONS.HEATED_SPLIT_SHOT.potency +
            ACTIONS.HEATED_SLUG_SHOT.combo.potency +
            ACTIONS.HEATED_CLEAN_SHOT.combo.potency
        ) / 3

        const chainSaws = (120 / ACTIONS.CHAIN_SAW.cooldown) * (BASE_GCD / gcd)
        const airAnchors = (120 / ACTIONS.AIR_ANCHOR.cooldown) * (BASE_GCD / gcd)
        const drills = (120 / ACTIONS.DRILL.cooldown) * (BASE_GCD / gcd)
        const maxFillers = (120 / gcd) 
            - chainSaws
            - airAnchors
            - drills

        const bsHeat = BARREL_STABILIZER_HEAT * (gcd / BASE_GCD)
        const fillersLostPerHC = (HEAT_BLASTS_PER_HC * HC_GCD) / gcd

        // Solve the expected amount of heat generated & used
        const heatExpression = nerdamer(`solve(
            x = ${bsHeat} + ${HEATED_COMBO_HEAT} * (
                ${maxFillers} - (${fillersLostPerHC} * (x / ${HYPERCHARGE_HEAT_COST}))
            )
        , x)`)
        const heatGenerated = Number(heatExpression.toDecimal())

        const heatBlasts = HEAT_BLASTS_PER_HC * (heatGenerated / HYPERCHARGE_HEAT_COST)
        const fillers = maxFillers - ((heatBlasts / 5) * fillersLostPerHC)

        const gcdPotency = 
            chainSaws * ACTIONS.CHAIN_SAW.potency +
            airAnchors * ACTIONS.AIR_ANCHOR.potency +
            drills * ACTIONS.DRILL.potency +
            fillers * fillerPotency

        const heatPotency = heatBlasts * (
            ACTIONS.HEAT_BLAST.potency +
            ACTIONS.GAUSS_ROUND.potency / 2 +
            ACTIONS.RICOCHET.potency / 2
        )

        const batteryPotency = BATTERY_PPG * (
            10 * (fillers / 3) +
            20 * chainSaws +
            20 * airAnchors
        )

        return gcdPotency + heatPotency + batteryPotency
    }

    // Returns the damage added by Reassemble over 2 minutes
    private reassembleDamagePerCycle(stats: ComputedSetStats): number {
        const uses = 120 / ACTIONS.REASSEMBLE.cooldown
        const reassembledToolDamage = baseDamage(stats, ACTIONS.DRILL.potency, "Weaponskill", true, true)
        const normalToolDamage = applyDhCrit(baseDamage(stats, ACTIONS.DRILL.potency, "Weaponskill"), stats)

        return uses * (reassembledToolDamage - normalToolDamage)
    }
}
