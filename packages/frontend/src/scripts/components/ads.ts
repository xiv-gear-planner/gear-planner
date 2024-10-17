type AdContainer = {
    inner: HTMLDivElement,
    outer: HTMLDivElement
}

function makeFixedArea(id: string, width: number, height: number): AdContainer {
    const inner = document.createElement('div');
    inner.id = id;
    inner.style.position = 'absolute';
    inner.style.backgroundColor = '#FF0000';
    inner.style.display = '';
    inner.style.zIndex = '-99';
    inner.style.height = `${height}px`;
    inner.style.width = `${width}px`;
    inner.style.bottom = '0';

    const outer = document.createElement('div');
    outer.style.position = 'sticky';
    outer.style.left = '0';
    outer.style.top = '100%';
    // outer.style.bottom = `${height}px`;
    outer.style.width = '0';
    outer.style.height = '0';
    outer.appendChild(inner);
    return {
        inner: inner,
        outer: outer
    };
}

let idCounter = 1;

function attachAdScript(element: HTMLDivElement) {
    let id = element.id;
    if (!id) {
        element.id = id = 'random-id-' + idCounter++;
    }
    setTimeout(() => {
        window['nitroAds']?.createAd(id, {
            "refreshTime": 30,
            "renderVisibleOnly": true,
            "sizes": [
                [
                    "300",
                    "600"
                ]
            ],
            "report": {
                "enabled": true,
                "icon": true,
                "wording": "Report Ad",
                "position": "top-right"
            },
            // "mediaQuery": "(min-width: 1025px), (min-width: 768px) and (max-width: 1024px)"
        });
    });
}

export function insertAds(element: HTMLElement) {

    try {
        const adAreaLeftWide = makeFixedArea('float-area-wide-left', 350, 650);
        {
            const outer = adAreaLeftWide.outer;
            const inner = adAreaLeftWide.inner;
            outer.style.left = '0';
            attachAdScript(inner);
            element.prepend(outer);
        }

        const adAreaRightWide = makeFixedArea('float-area-wide-right', 350, 650);
        {
            const outer = adAreaRightWide.outer;
            const inner = adAreaRightWide.inner;
            outer.style.left = '100%';
            inner.style.right = '0';
            attachAdScript(inner);
            element.prepend(outer);
        }
    }
    catch (e) {
        console.error(e);
    }
    // const adAreaRightWide = makeFixedArea('float-area-wide-right');
    // element.appendChild(adAreaLeftOuter);
    // element.appendChild(adAreaLeftWide);

    // const adAreaRightWide = makeFixedArea('float-area-wide-right');
    // attachAdScript(adAreaRightWide);
    // adAreaRightWide.style.right = '0';
    // adAreaRightWide.style.bottom = '0';
    // adAreaRightWide.style.width = '350px';
    // adAreaRightWide.style.height = '650px';
    // element.appendChild(adAreaRightWide);

}