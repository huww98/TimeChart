import { TimeChartSeriesOptions, TimeChartOptions } from './options';
import { scaleTime, scaleLinear } from "d3-scale";

export interface DataSeries {
    options: TimeChartSeriesOptions;
    data: DataPoint[];
    yRangeUpdatedIndex: number;
}

export interface DataPoint {
    x: number;
    y: number;
}

export class RenderModel {
    public xScale = scaleTime();
    public yScale = scaleLinear();
    private xAutoInitized = false;
    private yAutoInitized = false;
    public series = [] as DataSeries[];

    constructor(private options: TimeChartOptions) {
        if (options.xRange !== 'auto') {
            this.xScale.domain([options.xRange.min, options.xRange.max])
        }
        if (options.yRange !== 'auto') {
            this.yScale.domain([options.yRange.min, options.yRange.max])
        }
    }

    onResize(width: number, height: number) {
        const op = this.options;
        this.xScale.range([op.paddingLeft, width - op.paddingRight]);
        this.yScale.range([op.paddingTop, height - op.paddingBottom]);
    }

    update() {
        if (this.options.xRange === 'auto') {
            const maxDomain = Math.max(...this.series.map(s => s.data[s.data.length - 1].x));
            const minDomain = this.xAutoInitized ?
                this.xScale.domain()[0] :
                Math.min(...this.series.map(s => s.data[0].x));
            this.xScale.domain([minDomain, maxDomain]);
            this.xAutoInitized = true;
        }
        if (this.options.yRange === 'auto') {
            let minDomain = Math.min(
                ...this.series.map(s =>
                    Math.min(...s.data.slice(s.yRangeUpdatedIndex).map(d => d.y))
                )
            );
            let maxDomain = Math.max(
                ...this.series.map(s =>
                    Math.max(...s.data.slice(s.yRangeUpdatedIndex).map(d => d.y))
                )
            );
            if (this.yAutoInitized) {
                const origDomain = this.yScale.domain();
                minDomain = Math.min(origDomain[1], minDomain)
                maxDomain = Math.max(origDomain[0], maxDomain)
            }
            this.yScale.domain([maxDomain, minDomain]).nice();
            this.yAutoInitized = true;
            for (const s of this.series) {
                s.yRangeUpdatedIndex = s.data.length;
            }
        }
    }
}
