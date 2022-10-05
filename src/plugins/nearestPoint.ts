import { NearestPointModel } from "../core/nearestPoint";
import { SVGLayer } from "../core/svgLayer";
import { ResolvedCoreOptions, TimeChartSeriesOptions } from "../options";
import { TimeChartPlugin } from ".";
import { RenderModel } from "../core/renderModel";

export class NearestPoint {
    private intersectPoints = new Map<TimeChartSeriesOptions, SVGGeometryElement>();
    private container: SVGGElement;

    constructor(
        private svg: SVGLayer,
        private options: ResolvedCoreOptions,
        private model: RenderModel,
        private pModel: NearestPointModel
    ) {
        const initTrans = svg.svgNode.createSVGTransform();
        initTrans.setTranslate(0, 0);

        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
.timechart-crosshair-intersect {
    fill: var(--background-overlay, white);
    visibility: hidden;
}
.timechart-crosshair-intersect circle {
    r: 3px;
}`;
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
                intersect.transform.baseVal.initialize(initTrans);
                this.container.appendChild(intersect);
                this.intersectPoints.set(s, intersect);
            }
            const intersect = this.intersectPoints.get(s)!;
            intersect.style.stroke = (s.color ?? this.options.color).toString();
            intersect.style.strokeWidth = `${s.lineWidth ?? this.options.lineWidth}px`;
            const point = this.pModel.dataPoints.get(s);
            if (!point) {
                intersect.style.visibility = 'hidden';
            } else {
                intersect.style.visibility = 'visible';
                const p = this.model.pxPoint(point);
                intersect.transform.baseVal.getItem(0).setTranslate(p.x, p.y);
            }
        }
    }
}

export const nearestPoint: TimeChartPlugin<NearestPoint> = {
    apply(chart) {
        return new NearestPoint(chart.svgLayer, chart.options, chart.model, chart.nearestPoint);
    }
}
