import { EventDispatcher } from '../utils';
import { DIRECTION, dirOptions } from './options';
import { applyNewDomain, scaleK } from './utils';
export class ChartZoomMouse {
    constructor(el, options) {
        this.el = el;
        this.options = options;
        this.scaleUpdated = new EventDispatcher();
        this.previousPoint = null;
        const eventEl = options.eventElement;
        eventEl.style.userSelect = 'none';
        eventEl.addEventListener('pointerdown', ev => this.onMouseDown(ev));
        eventEl.addEventListener('pointerup', ev => this.onMouseUp(ev));
        eventEl.addEventListener('pointermove', ev => this.onMouseMove(ev));
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
        if (event.pointerType !== 'mouse')
            return;
        if ((event.buttons & this.options.panMouseButtons) === 0)
            return;
        const eventEl = this.options.eventElement;
        eventEl.setPointerCapture(event.pointerId);
        this.previousPoint = this.point(event);
        eventEl.style.cursor = 'grabbing';
    }
    onMouseUp(event) {
        if (this.previousPoint === null) {
            return;
        }
        const eventEl = this.options.eventElement;
        this.previousPoint = null;
        eventEl.releasePointerCapture(event.pointerId);
        eventEl.style.cursor = '';
    }
}
//# sourceMappingURL=mouse.js.map