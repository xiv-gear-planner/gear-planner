import {CustomRow} from "../tables";

export function installDragHelper(args: {dragHandle: HTMLElement, dragOuter: HTMLElement, moveHandler?: (ev: PointerEvent) => void, upHandler?: (ev: PointerEvent) => void, downHandler?: (ev: PointerEvent) => void}) {

    args.dragHandle.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        // ev.target['releasePointerCapture'](ev.pointerId);
        const elementCursorBefore = args.dragHandle.style.cursor;
        const body = document.body;
        const bodyCursorBefore = body.style.cursor;
        args.dragHandle.style.cursor = 'grabbing';
        body.style.cursor = 'grabbing';
        // args.dragOuter.setPointerCapture(ev.pointerId);
        const move = ev => {
            ev.preventDefault();
            args.moveHandler?.(ev);
        }
        const up = (ev) => {
            body.removeEventListener('pointermove', move);
            body.removeEventListener('pointerup', up);
            // body.releasePointerCapture(ev.pointerId);
            args.dragHandle.style.cursor = elementCursorBefore;
            args.dragOuter.style.cursor = bodyCursorBefore;
            args.upHandler?.(ev);
        }
        body.addEventListener('pointermove', move);
        body.addEventListener('pointerup', up);
        args.downHandler?.(ev);

    }, {

    })

}