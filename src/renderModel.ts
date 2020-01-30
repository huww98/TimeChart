import { TimeChartSeriesOptions, ResolvedOptions } from './options';
import { scaleLinear } from "d3-scale";

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

type UpdateCallback = () => void;

export class RenderModel {
    public xScale = scaleLinear();
    public yScale = scaleLinear();
    private xAutoInitized = false;
    private yAutoInitized = false;
    private seriesInfo = new Map<TimeChartSeriesOptions, DataSeriesInfo>();

    constructor(private options: ResolvedOptions) {
        if (options.xRange !== 'auto' && options.xRange) {
            this.xScale.domain([options.xRange.min, options.xRange.max])
        }
        if (options.yRange !== 'auto' && options.yRange) {
            this.yScale.domain([options.yRange.min, options.yRange.max])
        }
    }

    resize(width: number, height: number) {
        const op = this.options;
        this.xScale.range([op.paddingLeft, width - op.paddingRight]);
        this.yScale.range([op.paddingTop, height - op.paddingBottom]);
    }

    private updateCallbacks = [] as UpdateCallback[];
    onUpdate(callback: UpdateCallback) {
        this.updateCallbacks.push(callback);
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

        const opXRange = this.options.xRange;
        const opYRange = this.options.yRange;

        if (this.options.realTime || opXRange === 'auto') {
            const maxDomain = Math.max(...series.map(s => s.data[s.data.length - 1].x));
            if (this.options.realTime) {
                const currentDomain = this.xScale.domain();
                const range = currentDomain[1] - currentDomain[0];
                this.xScale.domain([maxDomain - range, maxDomain]);
            } else { // Auto
                const minDomain = this.xAutoInitized ?
                    this.xScale.domain()[0] :
                    Math.min(...series.map(s => s.data[0].x));
                this.xScale.domain([minDomain, maxDomain]);
                this.xAutoInitized = true;
            }
        } else if (opXRange) {
            this.xScale.domain([opXRange.min, opXRange.max])
        }

        if (opYRange === 'auto') {
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
        } else if (opYRange) {
            this.yScale.domain([opYRange.max, opYRange.min])
        }

        for (const cb of this.updateCallbacks) {
            cb();
        }
    }

    private redrawRequested = false;
    requestRedraw() {
        if (this.redrawRequested) {
            return;
        }
        this.redrawRequested = true;
        requestAnimationFrame((time) => {
            this.redrawRequested = false;
            this.update();
        });
    }
}
