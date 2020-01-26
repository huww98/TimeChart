import { axisBottom, axisLeft } from "d3-axis";
import { select, Selection, event } from "d3-selection";
import { zoom, ZoomTransform } from "d3-zoom";

import { ResolvedOptions } from './options';
import { RenderModel } from './renderModel';

export class SVGLayer {
    xg: Selection<SVGGElement, unknown, null, undefined>;
    yg: Selection<SVGGElement, unknown, null, undefined>;
    xAxis = axisBottom(this.model.xScale);
    yAxis = axisLeft(this.model.yScale);

    svgNode: SVGSVGElement;

    constructor(el: HTMLElement,
        private options: ResolvedOptions,
        private model: RenderModel,
    ) {
        model.onUpdate(() => this.update());

        el.style.position = 'relative';

        const svg = select(el).append('svg')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%');
        this.svgNode = svg.node()!;
        this.xg = svg.append('g');
        this.yg = svg.append('g');

        const xBeforeZoom = model.xScale;

        const zoomed = () => {
            const trans: ZoomTransform = event.transform;
            model.xScale = trans.rescaleX(xBeforeZoom);
            this.xAxis.scale(model.xScale);
            options.xRange = null;
            options.realTime = false;
            model.requestRedraw();
        }

        if (options.zoom) {
            const z = zoom()
                .on('zoom', zoomed);
            svg.call(z as any); // TODO: Workaround type check.
        }
    }

    update() {
        this.xg.call(this.xAxis);
        this.yg.call(this.yAxis);
    }

    onResize() {
        const svg = this.svgNode;
        const op = this.options;
        this.xg.attr('transform', `translate(0, ${svg.clientHeight - op.paddingBottom})`);
        this.yg.attr('transform', `translate(${op.paddingLeft}, 0)`);

        this.update()
    }
}
