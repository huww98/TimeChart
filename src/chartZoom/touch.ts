import { linearRegression, scaleK } from './utils';
import { DIRECTION, ResolvedOptions, CapableElement, dirOptions, Point } from './options';
import { EventDispatcher } from '../utils';

export class ChartZoomTouch {
    public scaleUpdated = new EventDispatcher<[]>();

    private majorDirection = DIRECTION.UNKNOWN;
    private previousPoints = new Map<number, Point>();
    private enabled = {
        [DIRECTION.X]: false,
        [DIRECTION.Y]: false,
    };

    constructor(private el: CapableElement, private options: ResolvedOptions) {
        el.addEventListener('touchstart', e => this.onTouchStart(e), { passive: true });
        el.addEventListener('touchend', e => this.onTouchEnd(e), { passive: true });
        el.addEventListener('touchcancel', e => this.onTouchEnd(e), { passive: true });
        el.addEventListener('touchmove', e => this.onTouchMove(e), { passive: true });

        this.update();
    }

    update() {
        this.syncEnabled();
        this.syncTouchAction();
    }

    private syncEnabled() {
        for (const { dir, op } of dirOptions(this.options)) {
            if (!op) {
                this.enabled[dir] = false;
            } else {
                const domain = op.scale.domain().sort();
                this.enabled[dir] = op.minDomain < domain[0] && domain[1] < op.maxDomain;
            }
        }
    }

    private syncTouchAction() {
        const actions = [];
        if (!this.enabled[DIRECTION.X]) {
            actions.push('pan-x');
        }
        if (!this.enabled[DIRECTION.Y]) {
            actions.push('pan-y');
        }
        if (actions.length === 0) {
            actions.push('none');
        }
        this.el.style.touchAction = actions.join(' ')
    }

    private touchPoints(touches: TouchList) {
        const boundingBox = this.el.getBoundingClientRect();
        const ts = new Map([...touches].map(t => [t.identifier, {
            [DIRECTION.X]: t.clientX - boundingBox.left,
            [DIRECTION.Y]: t.clientY - boundingBox.top,
        }]));
        let changed = false
        for (const {dir, op} of dirOptions(this.options)) {
            const scale = op.scale;
            const temp = [...ts.entries()].map(([id, p]) => ({ current: p[dir], previousPoint: this.previousPoints.get(id) }))
                .filter(t => t.previousPoint !== undefined)
                .map(({ current, previousPoint }) => ({ current, domain: scale.invert(previousPoint![dir]) }));
            if (temp.length === 0) {
                continue;
            }
            let k: number, b: number;
            if (dir === this.majorDirection && temp.length >= 2) {
                const res = linearRegression(temp.map(t => ({ x: t.current, y: t.domain })))
                k = res.k; b = res.b;
            } else {
                // Pan only
                k = scaleK(scale);
                b = temp.map(t => t.domain - k * t.current).reduce((a, b) => a + b) / temp.length;
            }
            const domain = scale.range().map(r => b + k * r);
            op.scale.domain(domain);
            changed = true;
        }
        this.previousPoints = ts;

        if (changed) {
            this.scaleUpdated.dispatch();
        }
        return changed;
    }

    private dirOptions(dir: DIRECTION.X | DIRECTION.Y) {
        return {
            [DIRECTION.X]: this.options.x,
            [DIRECTION.Y]: this.options.y,
        }[dir];
    }

    private onTouchStart(event: TouchEvent) {
        if (this.majorDirection === DIRECTION.UNKNOWN && event.touches.length >= 2) {
            const ts = [...event.touches];
            function vari(data: number[]) {
                const mean = data.reduce((a, b) => a + b) / data.length;
                return data.map(d => (d - mean) ** 2).reduce((a, b) => a + b);
            }
            const varX = vari(ts.map(t => t.clientX));
            const varY = vari(ts.map(t => t.clientY));
            this.majorDirection = varX > varY ? DIRECTION.X : DIRECTION.Y;
            if (this.dirOptions(this.majorDirection) === undefined) {
                this.majorDirection = DIRECTION.UNKNOWN;
            }
        }
        this.touchPoints(event.touches);
    }

    private onTouchEnd(event: TouchEvent) {
        if (event.touches.length === 0) {
            this.majorDirection = DIRECTION.UNKNOWN;
        }
        this.touchPoints(event.touches);
    }

    private onTouchMove(event: TouchEvent) {
        this.touchPoints(event.touches);
    }
}
