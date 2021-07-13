import { ChartZoom } from "../chartZoom";
export class TimeChartZoom {
    constructor(chart, options) {
        this.options = this.registerZoom(chart, options);
    }
    applyAutoRange(o, dataRange) {
        if (!o || !o.autoRange) {
            return;
        }
        let [min, max] = o.scale.domain();
        if (dataRange) {
            min = Math.min(min, dataRange.min);
            max = Math.max(max, dataRange.max);
        }
        o.minDomain = min;
        o.maxDomain = max;
    }
    registerZoom(chart, zoomOptions) {
        const z = new ChartZoom(chart.contentBoxDetector.node, {
            x: zoomOptions.x && {
                ...zoomOptions.x,
                scale: chart.model.xScale,
            },
            y: zoomOptions.y && {
                ...zoomOptions.y,
                scale: chart.model.yScale,
            }
        });
        const resolvedOptions = z.options;
        chart.model.updated.on(() => {
            this.applyAutoRange(resolvedOptions.x, chart.model.xRange);
            this.applyAutoRange(resolvedOptions.y, chart.model.yRange);
            z.update();
        });
        z.onScaleUpdated(() => {
            chart.options.xRange = null;
            chart.options.yRange = null;
            chart.options.realTime = false;
            chart.update();
        });
        return resolvedOptions;
    }
}
export class TimeChartZoomPlugin {
    constructor(o) {
        this.o = o;
    }
    apply(chart) {
        return new TimeChartZoom(chart, this.o);
    }
}
//# sourceMappingURL=chartZoom.js.map