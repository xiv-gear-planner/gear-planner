import {
    accountIcon,
    githubIcon,
    makeCalcIcon,
    makeImportIcon,
    makeKofiIcon,
    makeNewSheetIcon,
    makePatreonIcon,
    mySheetsIcon,
    settingsIcon
} from "./icons";
import {elt} from "./templates";

export function applyCommonSideMenuFormatting(link: HTMLAnchorElement) {
    if (link.getAttribute('formatted') === 'true') {
        return;
    }
    switch (link.textContent) {
        case 'My Sheets':
            link.replaceChildren(mySheetsIcon(), textSpan(link.textContent));
            link.title = 'View your saved sheets';
            break;
        case 'Back to XivGear':
            link.replaceChildren(mySheetsIcon(), textSpan(link.textContent));
            link.title = 'Back to XivGear';
            break;
        case 'Privacy':
            link.title = 'Privacy policy';
            break;
        case 'New Sheet':
            link.replaceChildren(makeNewSheetIcon(), textSpan(link.textContent));
            link.title = 'Create a new sheet from scratch';
            break;
        case 'Import':
            link.replaceChildren(makeImportIcon(), textSpan(link.textContent));
            link.title = 'Import sheets, sets, or Etro links into a new sheet';
            break;
        case 'GitHub':
            link.replaceChildren(githubIcon(), textSpan(link.textContent ?? 'GitHub'));
            link.title = 'Source code on GitHub';
            break;
        case 'Settings':
            link.replaceChildren(settingsIcon(), textSpan(link.textContent ?? 'Settings'));
            link.title = 'Light mode, theme, and other settings.';
            break;
        case 'Math':
        case 'Formulas':
            link.replaceChildren(makeCalcIcon(), textSpan(link.textContent ?? 'Math'));
            link.title = 'Math center';
            break;
        case 'Ko-Fi':
            link.replaceChildren(makeKofiIcon(), textSpan(link.textContent ?? 'Ko-Fi'));
            link.title = 'Donate on Ko-Fi';
            break;
        case 'Patreon':
            link.replaceChildren(makePatreonIcon(), textSpan(link.textContent ?? 'Patreon'));
            link.title = 'Donate on Patreon';
            break;
        default: {
            if (link.id === 'account-button') {
                link.replaceChildren(accountIcon(), ...link.querySelectorAll('span'));
                link.querySelectorAll('span').forEach(span => span.classList.add('menu-label'));
                link.title = 'Account';
                break;
            }
            const label = link.textContent ?? '';
            // link.replaceChildren(makeCalcIcon(), textSpan(label));
            break;
        }
    }
    link.setAttribute('formatted', 'true');
    if (!link.hasAttribute('aria-label')) {
        link.setAttribute('aria-label', link.title || link.textContent?.trim() || 'Navigation');
    }
}

function textSpan(text: string) {
    return elt('span', {class: 'menu-label'})`${text}`;
}

