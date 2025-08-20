import {recordEvent} from "@xivgear/common-ui/analytics/analytics";
import {arrayEq} from "@xivgear/util/array_utils";
import {RefreshLoop} from "@xivgear/util/refreshloop";

export function startSizeAnalytics() {
    const loop = new RefreshLoop(async () => doSizeAnalytics(), () => 5_000);
    loop.start();
}

type WH = [w: number, h: number];
let last: WH | undefined = undefined;

function doSizeAnalytics() {
    const editorArea = document.querySelector('gear-set-editor');
    if (editorArea) {
        const wh: WH = [editorArea.parentElement.clientWidth, editorArea.parentElement.clientHeight];
        if (!arrayEq(last, wh)) {
            console.log('editor area size changed', wh);
            recordEvent('editorAreaSize', {'size': `${wh[0]}x${wh[1]}`});
            last = wh;
        }
        return;
    }
    const embedTop = document.querySelector('#embed-top-level');
    if (embedTop) {
        const wh: WH = [embedTop.clientWidth, embedTop.clientHeight];
        if (!arrayEq(last, wh)) {
            console.log('embed area size changed', wh);
            recordEvent('embedAreaSize', {'size': `${wh[0]}x${wh[1]}`});
            last = wh;
        }
        return;
    }
    const viewerArea = document.querySelector('gear-set-viewer');
    if (viewerArea) {
        const wh: WH = [viewerArea.parentElement.clientWidth, viewerArea.parentElement.clientHeight];
        if (!arrayEq(last, wh)) {
            console.log('view area size changed', wh);
            recordEvent('viewerAreaSize', {'size': `${wh[0]}x${wh[1]}`});
            last = wh;
        }
    }
}
