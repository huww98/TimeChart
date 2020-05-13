import { SVGLayer } from './svgLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { RenderModel } from './renderModel';
import { ResolvedRenderOptions, TimeChartSeriesOptions } from './options';
import { domainSearch, EventDispatcher } from './utils';
import { CanvasLayer } from './canvasLayer';

export class NearestPointModel {
    static meta = {
        name: 'nearestPointModel',
        required: ['canvasLayer', 'model', 'options', 'contentBoxDetector']
    }

    points = new Map<TimeChartSeriesOptions, {x: number, y: number}>();
    private lastX: null | number = null;

    updated = new EventDispatcher();

    constructor(
        private canvas: CanvasLayer,
        private model: RenderModel,
        private options: ResolvedRenderOptions,
        detector: ContentBoxDetector
    ) {
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
        } else {
            const domain = this.model.xScale.invert(this.lastX);
            for (const s of this.options.series) {
                if (s.data.length == 0) {
                    this.points.delete(s);
                    continue;
                }
                const pos = domainSearch(s.data, 0, s.data.length, domain, d => d.x);
                const near: typeof s.data = [];
                if (pos > 0) {
                    near.push(s.data[pos - 1]);
                }
                if (pos < s.data.length) {
                    near.push(s.data[pos]);
                }
                const sortKey = (a: typeof near[0]) => Math.abs(a.x - domain);
                near.sort((a, b) => sortKey(a) - sortKey(b));
                const pxPoint = this.model.pxPoint(near[0]);
                const width = this.canvas.canvas.clientWidth;
                const height = this.canvas.canvas.clientHeight;

                if (pxPoint.x <= width && pxPoint.x >= 0 &&
                    pxPoint.y <= height && pxPoint.y >= 0) {
                    this.points.set(s, pxPoint);
                } else {
                    this.points.delete(s);
                }
            }
        }
        this.updated.dispatch();
    }
}

export class NearestPoint {
    static meta = {
        name: 'nearestPoint',
        required: ['svgLayer', 'options', 'nearestPointModel']
    }

    private intersectPoints = new Map<TimeChartSeriesOptions, SVGGeometryElement>();
    private container: SVGGElement;

    constructor(
        private svg: SVGLayer,
        private options: ResolvedRenderOptions,
        private pModel: NearestPointModel
    ) {
        const initTrans = svg.svgNode.createSVGTransform();
        initTrans.setTranslate(0, 0);

        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
        .timechart-crosshair-intersect {
            fill: ${options.backgroundColor};
            visibility: hidden;
        }
        .timechart-crosshair-intersect circle {
            r: 3px;
        }
        `;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('timechart-crosshair-intersect');
        g.appendChild(style);

        this.container = g;
        this.adjustIntersectPoints();

        svg.svgNode.appendChild(g);

        pModel.updated.on(() => this.adjustIntersectPoints());
    }

    adjustIntersectPoints() {
        const initTrans = this.svg.svgNode.createSVGTransform();
        initTrans.setTranslate(0, 0);
        for (const s of this.options.series) {
            if (!this.intersectPoints.has(s)) {
                const intersect = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                intersect.style.stroke = s.color.toString();
                intersect.style.strokeWidth = `${s.lineWidth ?? this.options.lineWidth}px`;
                intersect.transform.baseVal.initialize(initTrans);
                this.container.appendChild(intersect);
                this.intersectPoints.set(s, intersect);
            }
            const intersect = this.intersectPoints.get(s)!;
            const point = this.pModel.points.get(s);
            if (!point) {
                intersect.style.visibility = 'hidden';
            } else {
                intersect.style.visibility = 'visible';
                intersect.transform.baseVal.getItem(0).setTranslate(point.x, point.y);
            }
        }
    }
}
