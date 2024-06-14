import {githubIcon, importIcon, makeCalcIcon, makeDollarIcon, mySheetsIcon, newSheetIcon, settingsIcon} from "./util";

export function applyCommonTopMenuFormatting(link: HTMLAnchorElement) {
    if (link.getAttribute('formatted') === 'true') {
        return;
    }
    switch (link.textContent) {
        case 'My Sheets':
            link.replaceChildren(mySheetsIcon(), textSpan(link.textContent));
            break;
        case 'New Sheet':
            link.replaceChildren(newSheetIcon(), textSpan(link.textContent));
            break;
        case 'Import':
            link.replaceChildren(importIcon(), textSpan(link.textContent));
            break;
        case 'GitHub':
            link.replaceChildren(githubIcon());
            break;
        case 'Settings':
            link.replaceChildren(settingsIcon());
            break;
        case 'Math':
            link.replaceChildren(makeCalcIcon());
            break;
        case 'Ko-Fi':
            link.replaceChildren(makeDollarIcon());
            break;
    }
    link.setAttribute('formatted', 'true');
}

function textSpan(text: string) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
}

