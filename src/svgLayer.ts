import { axisBottom, axisLeft } from "d3-axis";
import { scaleTime } from  'd3-scale'
import { select, Selection } from "d3-selection";

import { ResolvedRenderOptions } from './options';
import { RenderModel } from './renderModel';

export class SVGLayer {
    xg: Selection<SVGGElement, unknown, null, undefined>;
    yg: Selection<SVGGElement, unknown, null, undefined>;
    xAxis = axisBottom(this.model.xScale);
    yAxis = axisLeft(this.model.yScale);

    svgNode: SVGSVGElement;

    constructor(el: HTMLElement,
        private options: ResolvedRenderOptions,
        private model: RenderModel,
    ) {
        model.updated.on(() => this.update());

        el.style.position = 'relative';

        const svg = select(el).append('svg')
            .style('position', 'absolute')
            .style('width', '100%')
            .style('height', '100%');
        this.svgNode = svg.node()!;
        this.xg = svg.append('g');
        this.yg = svg.append('g');
    }

    update() {
        const xs = this.model.xScale;
        const xts = scaleTime()
            .domain(xs.domain().map(d => d + this.options.baseTime))
            .range(xs.range());
        this.xAxis.scale(xts);
        this.xg.call(this.xAxis);

        this.yAxis.scale(this.model.yScale);
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
