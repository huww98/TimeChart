import { ChartZoom } from "../chartZoom";
import core from "../core";
import { MinMax } from "../core/renderModel";
import { ResolvedAxisZoomOptions, ResolvedZoomOptions, TimeChartPlugins, ZoomOptions } from "../options";
import { TimeChartPlugin } from ".";

export class TimeChartZoom {
    public options: ResolvedZoomOptions;

    constructor(chart: core<TimeChartPlugins>, options: ZoomOptions) {
        this.options = this.registerZoom(chart, options)
    }

    private applyAutoRange(o: ResolvedAxisZoomOptions | undefined, dataRange: MinMax | null) {
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

    private registerZoom(chart: core<TimeChartPlugins>, zoomOptions: ZoomOptions) {
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
        const resolvedOptions = z.options as ResolvedZoomOptions
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

export class TimeChartZoomPlugin implements TimeChartPlugin<TimeChartZoom> {
    constructor(private o: ZoomOptions) {
    }

    apply(chart: core<TimeChartPlugins>) {
        return new TimeChartZoom(chart, this.o);
    }
}
