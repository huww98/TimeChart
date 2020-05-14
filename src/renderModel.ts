import { TimeChartSeriesOptions, ResolvedRenderOptions } from './options';
import { scaleLinear } from "d3-scale";
import { EventDispatcher } from './utils';

interface DataSeriesInfo {
    yRangeUpdatedIndex: number;
}

export interface DataPoint {
    x: number;
    y: number;
}

interface MinMax { min: number; max: number; }

function maxMin(arr: number[]): MinMax {
    let max = -Infinity;
    let min = Infinity;
    for (const v of arr) {
        if (v > max) max = v;
        if (v < min) min = v;
    }
    return { max, min };
}

export class RenderModel {
    xScale = scaleLinear();
    yScale = scaleLinear();
    xRange: MinMax | null = null;
    yRange: MinMax | null = null;
    private seriesInfo = new Map<TimeChartSeriesOptions, DataSeriesInfo>();

    constructor(private options: ResolvedRenderOptions) {
        if (options.xRange !== 'auto' && options.xRange) {
            this.xScale.domain([options.xRange.min, options.xRange.max])
        }
        if (options.yRange !== 'auto' && options.yRange) {
            this.yScale.domain([options.yRange.min, options.yRange.max])
        }
    }

    resized = new EventDispatcher<(width: number, height: number) => void>();
    resize(width: number, height: number) {
        const op = this.options;
        this.xScale.range([op.paddingLeft, width - op.paddingRight]);
        this.yScale.range([height - op.paddingBottom, op.paddingTop]);

        this.resized.dispatch(width, height)
        this.requestRedraw()
    }

    updated = new EventDispatcher();
    disposing = new EventDispatcher();
    private disposed = false;

    dispose() {
        if (!this.disposed) {
            this.disposing.dispatch();
            this.disposed = true;
        }
    }

    update() {
        this.updateModel();
        this.updated.dispatch();
    }

    updateModel() {
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

        {
            const maxDomain = Math.max(...series.map(s => s.data[s.data.length - 1].x));
            const minDomain = this.xRange?.min ?? Math.min(...series.map(s => s.data[0].x));
            this.xRange = { max: maxDomain, min: minDomain };
            if (this.options.realTime || opXRange === 'auto') {
                if (this.options.realTime) {
                    const currentDomain = this.xScale.domain();
                    const range = currentDomain[1] - currentDomain[0];
                    this.xScale.domain([maxDomain - range, maxDomain]);
                } else { // Auto
                    this.xScale.domain([minDomain, maxDomain]);
                }
            } else if (opXRange) {
                this.xScale.domain([opXRange.min, opXRange.max])
            }
        }
        {
            const maxMinY = series.map(s => {
                const newY = s.data.slice(this.seriesInfo.get(s)!.yRangeUpdatedIndex).map(d => d.y)
                return maxMin(newY);
            })
            if (this.yRange) {
                maxMinY.push(this.yRange);
            }
            const minDomain = Math.min(...maxMinY.map(s => s.min));
            const maxDomain = Math.max(...maxMinY.map(s => s.max));
            this.yRange = { max: maxDomain, min: minDomain };
            if (opYRange === 'auto') {
                this.yScale.domain([minDomain, maxDomain]).nice();
                for (const s of series) {
                    this.seriesInfo.get(s)!.yRangeUpdatedIndex = s.data.length;
                }
            } else if (opYRange) {
                this.yScale.domain([opYRange.min, opYRange.max])
            }
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
            if (!this.disposed) {
                this.update();
            }
        });
    }

    pxPoint(dataPoint: DataPoint) {
        return {
            x: this.xScale(dataPoint.x),
            y: this.yScale(dataPoint.y),
        }
    }
}
