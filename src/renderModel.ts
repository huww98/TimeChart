import { TimeChartSeriesOptions, ResolvedOptions } from './options';
import { scaleTime, scaleLinear } from "d3-scale";

interface DataSeriesInfo {
    yRangeUpdatedIndex: number;
}

export interface DataPoint {
    x: number;
    y: number;
}

function maxMin(arr: number[]) {
    let max = -Infinity;
    let min = Infinity;
    for (const v of arr) {
        if (v > max) max = v;
        if (v < min) min = v;
    }
    return { max, min };
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
        if (this.options.realTime || this.options.xRange === 'auto') {
            const maxDomain = this.options.baseTime + Math.max(...series.map(s => s.data[s.data.length - 1].x));
            if (this.options.realTime) {
                const currentDomain = this.xScale.domain();
                const range = currentDomain[1].getTime() - currentDomain[0].getTime();
                this.xScale.domain([maxDomain - range, maxDomain]);
            } else { // Auto
                const minDomain = this.xAutoInitized ?
                    this.xScale.domain()[0] :
                    this.options.baseTime + Math.min(...series.map(s => s.data[0].x));
                this.xScale.domain([minDomain, maxDomain]);
                this.xAutoInitized = true;
            }
        }
        if (this.options.yRange === 'auto') {
            const maxMinY = series.map(s => {
                const newY = s.data.slice(this.seriesInfo.get(s)!.yRangeUpdatedIndex).map(d => d.y)
                return maxMin(newY);
            })
            if (this.yAutoInitized) {
                const origDomain = this.yScale.domain();
                maxMinY.push({
                    min: origDomain[1],
                    max: origDomain[0],
                });
            }
            const minDomain = Math.min(...maxMinY.map(s => s.min));
            const maxDomain = Math.max(...maxMinY.map(s => s.max));

            this.yScale.domain([maxDomain, minDomain]).nice();
            this.yAutoInitized = true;
            for (const s of series) {
                this.seriesInfo.get(s)!.yRangeUpdatedIndex = s.data.length;
            }
        }
    }
}
