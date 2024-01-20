import {CustomRow} from "../tables";

export function installDragHelper(args: {dragHandle: HTMLElement, dragOuter: HTMLElement, moveHandler?: (ev: PointerEvent) => void, upHandler?: (ev: PointerEvent) => void, downHandler?: (ev: PointerEvent) => void}) {

    args.dragHandle.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        const elementCursorBefore = args.dragHandle.style.cursor;
        const body = document.body;
        const bodyCursorBefore = body.style.cursor;
        args.dragHandle.style.cursor = 'grabbing';
        body.style.cursor = 'grabbing';
        const move = ev => {
            ev.preventDefault();
            args.moveHandler?.(ev);
        }
        const up = (ev) => {
            body.removeEventListener('pointermove', move);
            body.removeEventListener('pointerup', up);
            args.dragHandle.style.cursor = elementCursorBefore;
            body.style.cursor = bodyCursorBefore;
            args.upHandler?.(ev);
        }
        body.addEventListener('pointermove', move);
        body.addEventListener('pointerup', up);
        args.downHandler?.(ev);

    })

}