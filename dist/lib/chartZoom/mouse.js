import { EventDispatcher } from '../utils';
import { DIRECTION, dirOptions } from './options';
import { applyNewDomain, scaleK } from './utils';
export class ChartZoomMouse {
    constructor(el, options) {
        this.el = el;
        this.options = options;
        this.scaleUpdated = new EventDispatcher();
        this.previousPoint = null;
        el.style.userSelect = 'none';
        el.addEventListener('pointerdown', ev => this.onMouseDown(ev));
        el.addEventListener('pointerup', ev => this.onMouseUp(ev));
        el.addEventListener('pointermove', ev => this.onMouseMove(ev));
    }
    point(ev) {
        const boundingRect = this.el.getBoundingClientRect();
        return {
            [DIRECTION.X]: ev.clientX - boundingRect.left,
            [DIRECTION.Y]: ev.clientY - boundingRect.top,
        };
    }
    onMouseMove(event) {
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
    onMouseDown(event) {
        if (event.pointerType !== 'mouse') {
            return;
        }
        this.el.setPointerCapture(event.pointerId);
        this.previousPoint = this.point(event);
        this.el.style.cursor = 'grabbing';
    }
    onMouseUp(event) {
        if (this.previousPoint === null) {
            return;
        }
        this.previousPoint = null;
        this.el.releasePointerCapture(event.pointerId);
        this.el.style.cursor = '';
    }
}
//# sourceMappingURL=mouse.js.map