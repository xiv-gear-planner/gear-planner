import {FieldBoundCheckBox, labeledCheckbox, quickElement} from "@xivgear/common-ui/components/util";
import {BlmSettings, BlmSimResult} from "@xivgear/core/sims/caster/blm/blm_sheet_sim";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {col, CustomColumn} from "@xivgear/common-ui/table/tables";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {BlmElement, BlmGaugeState} from "@xivgear/core/sims/caster/blm/blm_types";

export class BlmSimGui extends BaseMultiCycleSimGui<BlmSimResult, BlmSettings> {

    protected extraAbilityUsedColumns(result: CycleSimResult): CustomColumn<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'astral-fire-umbral-ice',
            displayName: 'AF/UI',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<BlmGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }

                const gauge = usedAbility.gaugeAfter;

                const children = [];

                if (gauge.element === BlmElement.Ice) {
                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= gauge.elementLevel ? 'blm-element-ice' : 'blm-element-default'], []));
                    }
                }
                else if (gauge.element === BlmElement.Fire) {
                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= gauge.elementLevel ? 'blm-element-fire' : 'blm-element-default'], []));
                    }
                }
                else {
                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', ['blm-element-default'], []));
                    }
                }

                if (gauge.level >= 90) {
                    children.push(quickElement('span', [gauge.paradox ? 'blm-paradox-full' : 'blm-paradox-default'], []));
                }

                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }), col({
            shortName: 'umbral-hearts',
            displayName: 'Umbral Hearts',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<BlmGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }

                const umbralHearts = usedAbility.gaugeAfter.umbralHearts;

                const children = [];

                for (let i = 1; i <= 3; i++) {
                    children.push(quickElement('span', [i <= umbralHearts ? 'blm-umbralhearts-full' : 'blm-umbralhearts-default'], []));
                }

                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }), col({
            shortName: 'polyglot',
            displayName: 'Polyglot',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<BlmGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }

                const polyglot = usedAbility.gaugeAfter.polyglot;

                const children = [];

                for (let i = 1; i <= 3; i++) {
                    children.push(quickElement('span', [i <= polyglot ? 'blm-polyglot-full' : 'blm-polyglot-default'], []));
                }

                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }), col({
            shortName: 'astral-soul',
            displayName: 'Astral Soul',
            getter: used => isFinalizedAbilityUse(used) && ((used.original.gaugeAfter as BlmGaugeState).level === 100) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<BlmGaugeState>) => {
                if (usedAbility === null || usedAbility.gaugeAfter.level < 100) {
                    return document.createTextNode("");
                }

                const astralSoul = usedAbility.gaugeAfter.astralSoul;

                const children = [];

                for (let i = 1; i <= 6; i++) {
                    children.push(quickElement('span', [i <= astralSoul ? 'blm-astralsoul-full' : 'blm-astralsoul-default'], []));
                }

                return quickElement('div', ['icon-gauge-holder'], children);
            },
        }), col({
            shortName: 'mp',
            displayName: 'MP',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility<BlmGaugeState>) => {
                if (usedAbility === null) {
                    return document.createTextNode("");
                }

                const mp = usedAbility.gaugeAfter.magicPoints;

                const div = document.createElement('div');
                div.style.height = '100%';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.gap = '6px';
                div.style.padding = '2px 0 2px 0';
                div.style.boxSizing = 'border-box';

                const span = document.createElement('span');
                span.textContent = `${mp}`;

                const barOuter = document.createElement('div');
                barOuter.style.borderRadius = '20px';
                barOuter.style.background = '#00000033';
                barOuter.style.width = '120px';
                barOuter.style.height = 'calc(100% - 3px)';
                barOuter.style.display = 'inline-block';
                barOuter.style.overflow = 'hidden';
                barOuter.style.border = '1px solid black';

                const barInner = document.createElement('div');
                barInner.style.backgroundColor = '#df5591';
                barInner.style.width = `${Math.round((mp / 10000) * 100)}%`;
                barInner.style.height = '100%';
                barOuter.appendChild(barInner);

                div.appendChild(barOuter);
                div.appendChild(span);

                return div;
            },
        })];
    }

    override makeCustomConfigInterface(settings: BlmSettings, _updateCallback: () => void): HTMLElement | null {
        const configDiv = document.createElement("div");

        const prepullLLCB = new FieldBoundCheckBox(settings, "prepullLL");

        configDiv.appendChild(labeledCheckbox("Pre-pull Ley Lines", prepullLLCB));

        const potCb = new FieldBoundCheckBox(settings, "usePotion");

        configDiv.appendChild(labeledCheckbox("Use Potion", potCb));

        const flareOpenerCB = new FieldBoundCheckBox(settings, "useFlareOpener");

        configDiv.appendChild(labeledCheckbox("Use alternative single-target Flare opener", flareOpenerCB));

        const transposeFromUICB = new FieldBoundCheckBox(settings, "transposeFromUmbralIce");

        configDiv.appendChild(labeledCheckbox("Transpose out of Umbral Ice (standard AF1 F3P)", transposeFromUICB));

        const transposeFromAFCB = new FieldBoundCheckBox(settings, "transposeFromAstralFire");

        configDiv.appendChild(labeledCheckbox("Transpose out of Astral Fire (instant UI1 B3)", transposeFromAFCB));

        return configDiv;
    }
}
