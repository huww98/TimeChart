import { CapableElement, ResolvedOptions, Point, DIRECTION, dirOptions } from './options';
import { scaleK, applyNewDomain } from './utils';
import { EventDispatcher } from '../utils';

export class ChartZoomMouse {
    public scaleUpdated = new EventDispatcher<[]>();
    private previousPoint: Point | null = null;

    constructor(private el: CapableElement, private options: ResolvedOptions) {
        el.style.userSelect = 'none';
        el.addEventListener('pointerdown', ev => this.onMouseDown(ev));
        el.addEventListener('pointerup', ev => this.onMouseUp(ev));
        el.addEventListener('pointermove', ev => this.onMouseMove(ev));
    }

    private point(ev: MouseEvent) {
        const boundingRect = this.el.getBoundingClientRect();
        return {
            [DIRECTION.X]: ev.clientX - boundingRect.left,
            [DIRECTION.Y]: ev.clientY - boundingRect.top,
        };
    }

    private onMouseMove(event: PointerEvent) {
        if (this.previousPoint === null) {
            return;
        }
        const p = this.point(event);
        let changed = false;
        for (const { dir, op } of dirOptions(this.options)) {
            const offset = p[dir] - this.previousPoint[dir];
            const k = scaleK(op.scale);
            const domain = op.scale.domain();
            const newDomain = domain.map(d => d - k * offset);
            if (applyNewDomain(op, newDomain)) {
                changed = true;
            }
        }
        this.previousPoint = p;
        if (changed) {
            this.scaleUpdated.dispatch();
        }
    }

    private onMouseDown(event: PointerEvent) {
        if (event.pointerType !== 'mouse') {
            return;
        }
        this.el.setPointerCapture(event.pointerId);
        this.previousPoint = this.point(event);
        this.el.style.cursor = 'grabbing';
    }

    private onMouseUp(event: PointerEvent) {
        if (this.previousPoint === null) {
            return;
        }
        this.previousPoint = null
        this.el.releasePointerCapture(event.pointerId);
        this.el.style.cursor = '';
    }
}
