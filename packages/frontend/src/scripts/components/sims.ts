import {ContactInfo, MaintainerInfo, SimSpec} from "@xivgear/core/sims/sim_types";
import {discordIcon, quickElement} from "@xivgear/common-ui/components/util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function simMaintainersInfoElement(simSpec: SimSpec<any, any>): HTMLElement | null {
    if (simSpec.maintainers) {
        const maintainers = simSpec.maintainers;
        return quickElement('div', ['sim-contact-info-area'], ["Maintainers: ", ...maintainers.map(simMaintainerSingle)]);
    }
    else {
        return null;
    }
}

function simMaintainerSingle(info: MaintainerInfo): HTMLElement {
    const nodes = info.contact.length === 0 ? [info.name] : [`${info.name} (`, ...info.contact.map(contactInfoSingle), ')'];
    return quickElement('span', ['sim-contact-info'], nodes);
}

function contactInfoSingle(info: ContactInfo): HTMLElement {
    switch (info.type) {
        case "discord": {
            const discordLink = quickElement('a', ['discord-link'], [discordIcon(), info.discordTag]);
            discordLink.href = `https://discord.com/users/${info.discordUid}`;
            discordLink.target = '_blank';
            return discordLink;
        }
    }
}