import { ChartZoom, defaultAxisOptions, resolveOptions,  } from "../chartZoom";
import { ResolvedOptions as ResolvedChartZoomOptions } from "../chartZoom/options";
import core from "../core";
import { MinMax } from "../core/renderModel";
import { ResolvedZoomOptions, TimeChartPlugins, ZoomOptions } from "../options";
import { TimeChartPlugin } from ".";
import { ScaleLinear } from "d3-scale";

export class TimeChartZoom {
    constructor(chart: core<TimeChartPlugins>, public options: ResolvedZoomOptions) {
        this.registerZoom(chart)
    }

    private applyAutoRange(o: {scale: ScaleLinear<number, number>, autoRange: boolean, minDomain?: number, maxDomain?: number} | undefined, dataRange: MinMax | null) {
        if (!o)
            return;
        if (!o.autoRange) {
            delete o.minDomain;
            delete o.maxDomain;
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

    private registerZoom(chart: core<TimeChartPlugins>) {
        if (this.options.x)
            Object.setPrototypeOf(this.options.x, Object.assign(Object.create(defaults), { scale: chart.model.xScale }));
        if (this.options.y)
            Object.setPrototypeOf(this.options.y, Object.assign(Object.create(defaults), { scale: chart.model.yScale }));

        const o = this.options as ResolvedZoomOptions & ResolvedChartZoomOptions;
        const z = new ChartZoom(chart.contentBoxDetector.node, o);
        chart.model.updated.on(() => {
            this.applyAutoRange(o.x, chart.model.xRange);
            this.applyAutoRange(o.y, chart.model.yRange);
            z.update();
        });
        z.onScaleUpdated(() => {
            chart.options.xRange = null;
            chart.options.yRange = null;
            chart.options.realTime = false;
            chart.update();
        });
    }
}

const defaults = Object.assign(Object.create(defaultAxisOptions) as typeof defaultAxisOptions, {
    autoRange: true,
} as const);

export class TimeChartZoomPlugin implements TimeChartPlugin<TimeChartZoom> {
    options: ResolvedZoomOptions;
    constructor(o?: ZoomOptions) {
        this.options = resolveOptions(defaults, o);
    }

    apply(chart: core<TimeChartPlugins>) {
        return new TimeChartZoom(chart, this.options);
    }
}
