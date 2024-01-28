import { scaleLinear } from "d3-scale";
import { EventDispatcher } from '../utils';
function calcMinMaxY(arr, start, end) {
    let max = -Infinity;
    let min = Infinity;
    for (let i = start; i < end; i++) {
        const v = arr[i].y;
        if (v > max)
            max = v;
        if (v < min)
            min = v;
    }
    return { max, min };
}
function unionMinMax(...items) {
    return {
        min: Math.min(...items.map(i => i.min)),
        max: Math.max(...items.map(i => i.max)),
    };
}
export class RenderModel {
    constructor(options) {
        this.options = options;
        this.xScale = scaleLinear();
        this.yScale = scaleLinear();
        this.xRange = null;
        this.yRange = null;
        this.resized = new EventDispatcher();
        this.updated = new EventDispatcher();
        this.disposing = new EventDispatcher();
        this.abortController = new AbortController();
        this.redrawRequested = false;
        if (options.xRange !== 'auto' && options.xRange) {
            this.xScale.domain([options.xRange.min, options.xRange.max]);
        }
        if (options.yRange !== 'auto' && options.yRange) {
            this.yScale.domain([options.yRange.min, options.yRange.max]);
        }
    }
    resize(width, height) {
        const op = this.options;
        this.xScale.range([op.paddingLeft, width - op.paddingRight]);
        this.yScale.range([height - op.paddingBottom, op.paddingTop]);
        this.resized.dispatch(width, height);
        this.requestRedraw();
    }
    dispose() {
        if (!this.abortController.signal.aborted) {
            this.abortController.abort();
            this.disposing.dispatch();
        }
    }
    update() {
        this.updateModel();
        this.updated.dispatch();
        for (const s of this.options.series) {
            s.data._synced();
        }
    }
    updateModel() {
        const series = this.options.series.filter(s => s.data.length > 0);
        if (series.length === 0) {
            return;
        }
        const o = this.options;
        {
            const maxDomain = Math.max(...series.map(s => s.data[s.data.length - 1].x));
            const minDomain = Math.min(...series.map(s => s.data[0].x));
            this.xRange = { max: maxDomain, min: minDomain };
            if (this.options.realTime || o.xRange === 'auto') {
                if (this.options.realTime) {
                    const currentDomain = this.xScale.domain();
                    const range = currentDomain[1] - currentDomain[0];
                    this.xScale.domain([maxDomain - range, maxDomain]);
                }
                else { // Auto
                    this.xScale.domain([minDomain, maxDomain]);
                }
            }
            else if (o.xRange) {
                this.xScale.domain([o.xRange.min, o.xRange.max]);
            }
        }
        {
            const minMaxY = series.flatMap(s => {
                return [
                    calcMinMaxY(s.data, 0, s.data.pushed_front),
                    calcMinMaxY(s.data, s.data.length - s.data.pushed_back, s.data.length),
                ];
            });
            if (this.yRange) {
                minMaxY.push(this.yRange);
            }
            this.yRange = unionMinMax(...minMaxY);
            if (o.yRange === 'auto') {
                this.yScale.domain([this.yRange.min, this.yRange.max]).nice();
            }
            else if (o.yRange) {
                this.yScale.domain([o.yRange.min, o.yRange.max]);
            }
        }
    }
    requestRedraw() {
        if (this.redrawRequested) {
            return;
        }
        this.redrawRequested = true;
        const signal = this.abortController.signal;
        requestAnimationFrame((time) => {
            this.redrawRequested = false;
            if (!signal.aborted) {
                this.update();
            }
        });
    }
    pxPoint(dataPoint) {
        return {
            x: this.xScale(dataPoint.x),
            y: this.yScale(dataPoint.y),
        };
    }
}
//# sourceMappingURL=renderModel.js.map