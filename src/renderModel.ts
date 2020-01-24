import { TimeChartSeriesOptions, ResolvedOptions } from './options';
import { scaleTime, scaleLinear } from "d3-scale";

interface DataSeriesInfo {
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
    private seriesInfo = new Map<TimeChartSeriesOptions, DataSeriesInfo>();

    constructor(private options: ResolvedOptions) {
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
        for (const s of this.options.series) {
            if (!this.seriesInfo.has(s)) {
                this.seriesInfo.set(s, {
                    yRangeUpdatedIndex: 0,
                });
            }
        }

        const series = this.options.series.filter(s => s.data.length > 0);
        if (series.length === 0) {
            return;
        }
        if (this.options.xRange === 'auto') {
            const maxDomain = this.options.baseTime + Math.max(...series.map(s => s.data[s.data.length - 1].x));
            const minDomain = this.xAutoInitized ?
                this.xScale.domain()[0] :
                this.options.baseTime + Math.min(...series.map(s => s.data[0].x));
            this.xScale.domain([minDomain, maxDomain]);
            this.xAutoInitized = true;
        }
        if (this.options.yRange === 'auto') {
            const minMax = series.map(s => {
                const newY = s.data.slice(this.seriesInfo.get(s)!.yRangeUpdatedIndex).map(d => d.y)
                return {
                    min: Math.min(...newY),
                    max: Math.max(...newY),
                }
            })
            if (this.yAutoInitized) {
                const origDomain = this.yScale.domain();
                minMax.push({
                    min: origDomain[1],
                    max: origDomain[0],
                });
            }
            const minDomain = Math.min(...minMax.map(s => s.min));
            const maxDomain = Math.max(...minMax.map(s => s.max));

            this.yScale.domain([maxDomain, minDomain]).nice();
            this.yAutoInitized = true;
            for (const s of series) {
                this.seriesInfo.get(s)!.yRangeUpdatedIndex = s.data.length;
            }
        }
    }
}
