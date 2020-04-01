import { select, Selection } from "d3-selection";
import { scaleTime } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { ResolvedRenderOptions } from "./options";
import { RenderModel } from './renderModel';

export class D3AxisRenderer {
    xg: Selection<SVGGElement, unknown, null, undefined>;
    yg: Selection<SVGGElement, unknown, null, undefined>;
    xAxis = axisBottom(this.model.xScale);
    yAxis = axisLeft(this.model.yScale);

    constructor(private model: RenderModel, svg: SVGSVGElement, private options: ResolvedRenderOptions) {
        const d3Svg = select(svg)
        this.xg = d3Svg.append('g');
        this.yg = d3Svg.append('g');

        model.updated.on(() => this.update());
        model.resized.on((w, h) => this.onResize(w, h));
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

    onResize(width: number, height: number) {
        const op = this.options;
        this.xg.attr('transform', `translate(0, ${height - op.paddingBottom})`);
        this.yg.attr('transform', `translate(${op.paddingLeft}, 0)`);

        this.update()
    }
}
