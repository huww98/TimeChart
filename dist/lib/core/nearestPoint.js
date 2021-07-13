import { domainSearch, EventDispatcher } from '../utils';
export class NearestPointModel {
    constructor(canvas, model, options, detector) {
        this.canvas = canvas;
        this.model = model;
        this.options = options;
        this.points = new Map();
        this.lastX = null;
        this.updated = new EventDispatcher();
        detector.node.addEventListener('mousemove', ev => {
            const rect = canvas.canvas.getBoundingClientRect();
            this.lastX = ev.clientX - rect.left;
            this.adjustPoints();
        });
        detector.node.addEventListener('mouseleave', ev => {
            this.lastX = null;
            this.adjustPoints();
        });
        model.updated.on(() => this.adjustPoints());
    }
    adjustPoints() {
        if (this.lastX === null) {
            this.points.clear();
        }
        else {
            const domain = this.model.xScale.invert(this.lastX);
            for (const s of this.options.series) {
                if (s.data.length == 0 || !s.visible) {
                    this.points.delete(s);
                    continue;
                }
                const pos = domainSearch(s.data, 0, s.data.length, domain, d => d.x);
                const near = [];
                if (pos > 0) {
                    near.push(s.data[pos - 1]);
                }
                if (pos < s.data.length) {
                    near.push(s.data[pos]);
                }
                const sortKey = (a) => Math.abs(a.x - domain);
                near.sort((a, b) => sortKey(a) - sortKey(b));
                const pxPoint = this.model.pxPoint(near[0]);
                const width = this.canvas.canvas.clientWidth;
                const height = this.canvas.canvas.clientHeight;
                if (pxPoint.x <= width && pxPoint.x >= 0 &&
                    pxPoint.y <= height && pxPoint.y >= 0) {
                    this.points.set(s, pxPoint);
                }
                else {
                    this.points.delete(s);
                }
            }
        }
        this.updated.dispatch();
    }
}
//# sourceMappingURL=nearestPoint.js.map