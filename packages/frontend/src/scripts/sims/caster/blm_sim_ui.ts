
import {FieldBoundCheckBox, labeledCheckbox} from "@xivgear/common-ui/components/util";
import {BlmSettings, BlmSimResult} from "@xivgear/core/sims/caster/blm/blm_sheet_sim";
import {BaseMultiCycleSimGui} from "../multicyclesim_ui";
import {AbilitiesUsedTable} from "../components/ability_used_table";
import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {col, CustomColumn} from "@xivgear/common-ui/table/tables";
import {quickElement} from "@xivgear/common-ui/components/util";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {BlmExtraData} from "@xivgear/core/sims/caster/blm/blm_types";

export class BlmSimGui extends BaseMultiCycleSimGui<BlmSimResult, BlmSettings> {

    protected extraAbilityUsedColumns(result: CycleSimResult): CustomColumn<DisplayRecordFinalized, unknown, unknown>[] {
        return [col({
            shortName: 'astral-fire-umbral-ice',
            displayName: 'AF/UI',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const aspectElement = (usedAbility.extraData as BlmExtraData).gauge.aspect;
                    const paradox = (usedAbility.extraData as BlmExtraData).gauge.paradox;

                    const children = [];

                    // negative is ice.
                    if (aspectElement <= 0) {
                        for (let i = 1; i <= 3; i++) {
                            children.push(quickElement('span', [i <= (-aspectElement) ? 'blm-element-ice' : 'blm-element-default'], []));
                        }
                    }
                    else {
                        for (let i = 1; i <= 3; i++) {
                            children.push(quickElement('span', [i <= (+aspectElement) ? 'blm-element-fire' : 'blm-element-default'], []));
                        }
                    }

                    children.push(quickElement('span', [paradox ? 'blm-paradox-full' : 'blm-paradox-default'], []));

                    return quickElement('div', ['icon-gauge-holder'], children);
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'umbral-hearts',
            displayName: 'Umbral Hearts',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const umbralHearts = (usedAbility.extraData as BlmExtraData).gauge.umbralHearts;

                    const children = [];

                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= umbralHearts ? 'blm-umbralhearts-full' : 'blm-umbralhearts-default'], []));
                    }

                    return quickElement('div', ['icon-gauge-holder'], children);
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'polyglot',
            displayName: 'Polyglot',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const polyglot = (usedAbility.extraData as BlmExtraData).gauge.polyglot;

                    const children = [];

                    for (let i = 1; i <= 3; i++) {
                        children.push(quickElement('span', [i <= polyglot ? 'blm-polyglot-full' : 'blm-polyglot-default'], []));
                    }

                    return quickElement('div', ['icon-gauge-holder'], children);
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'astral-soul',
            displayName: 'Astral Soul',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const astralSoul = (usedAbility.extraData as BlmExtraData).gauge.astralSoul;

                    const children = [];

                    for (let i = 1; i <= 6; i++) {
                        children.push(quickElement('span', [i <= astralSoul ? 'blm-astralsoul-full' : 'blm-astralsoul-default'], []));
                    }

                    return quickElement('div', ['icon-gauge-holder'], children);
                }
                return document.createTextNode("");
            },
        }), col({
            shortName: 'mp',
            displayName: 'MP',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const mp = (usedAbility.extraData as BlmExtraData).gauge.mp;

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
                }
                return document.createTextNode("");
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

        configDiv.appendChild(labeledCheckbox("Use Flare opener", flareOpenerCB));

        const transposeFromUICB = new FieldBoundCheckBox(settings, "transposeFromUmbralIce");

        configDiv.appendChild(labeledCheckbox("Transpose out of Umbral Ice (standard AF1 F3P)", transposeFromUICB));

        const transposeFromAFCB = new FieldBoundCheckBox(settings, "transposeFromAstralFire");

        configDiv.appendChild(labeledCheckbox("Transpose out of Astral Fire (instant UI1 B3)", transposeFromAFCB));
        return configDiv;
    }
}
