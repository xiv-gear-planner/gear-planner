import {githubIcon, importIcon, makeCalcIcon, makeDollarIcon, mySheetsIcon, newSheetIcon, settingsIcon} from "./util";

export function applyCommonTopMenuFormatting(link: HTMLAnchorElement) {
    if (link.getAttribute('formatted') === 'true') {
        return;
    }
    switch (link.textContent) {
        case 'My Sheets':
            link.replaceChildren(mySheetsIcon(), textSpan(link.textContent));
            link.title = 'View your saved sheets';
            break;
        case 'New Sheet':
            link.replaceChildren(newSheetIcon(), textSpan(link.textContent));
            link.title = 'Create a new sheet from scratch';
            break;
        case 'Import':
            link.replaceChildren(importIcon(), textSpan(link.textContent));
            link.title = 'Import sheets, sets, or Etro links into a new sheet';
            break;
        case 'GitHub':
            link.replaceChildren(githubIcon());
            link.title = 'Source code on GitHub';
            break;
        case 'Settings':
            link.replaceChildren(settingsIcon());
            link.title = 'Light mode, theme, and other settings.';
            break;
        case 'Math':
            link.replaceChildren(makeCalcIcon());
            link.title = 'Math center';
            break;
        case 'Ko-Fi':
            link.replaceChildren(makeDollarIcon());
            link.title = 'Donate on Ko-Fi';
            break;
    }
    link.setAttribute('formatted', 'true');
}

function textSpan(text: string) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
}

