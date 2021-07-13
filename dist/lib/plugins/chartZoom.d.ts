import core from "../core";
import { ResolvedZoomOptions, TimeChartPlugins, ZoomOptions } from "../options";
import { TimeChartPlugin } from ".";
export declare class TimeChartZoom {
    options: ResolvedZoomOptions;
    constructor(chart: core<TimeChartPlugins>, options: ZoomOptions);
    private applyAutoRange;
    private registerZoom;
}
export declare class TimeChartZoomPlugin implements TimeChartPlugin<TimeChartZoom> {
    private o;
    constructor(o: ZoomOptions);
    apply(chart: core<TimeChartPlugins>): TimeChartZoom;
}
