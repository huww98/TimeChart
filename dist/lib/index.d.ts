import core from './core';
import { NoPlugin, ResolvedOptions, TimeChartOptions, TimeChartPlugins } from './options';
import { TimeChartZoomPlugin } from './plugins/chartZoom';
import { crosshair } from './plugins/crosshair';
import { d3Axis } from './plugins/d3Axis';
import { legend } from './plugins/legend';
import { lineChart } from './plugins/lineChart';
import { nearestPoint } from './plugins/nearestPoint';
declare type TDefaultPlugins = {
    lineChart: typeof lineChart;
    d3Axis: typeof d3Axis;
    crosshair: typeof crosshair;
    nearestPoint: typeof nearestPoint;
    legend: typeof legend;
    zoom: TimeChartZoomPlugin;
};
export default class TimeChart<TPlugins extends TimeChartPlugins = NoPlugin> extends core<TPlugins & TDefaultPlugins> {
    el: HTMLElement;
    static core: typeof core;
    static plugins: {
        lineChart: import("./plugins").TimeChartPlugin<import("./plugins/lineChart").LineChartRenderer>;
        d3Axis: import("./plugins").TimeChartPlugin<any>;
        crosshair: import("./plugins").TimeChartPlugin<void>;
        nearestPoint: import("./plugins").TimeChartPlugin<import("./plugins/nearestPoint").NearestPoint>;
        legend: import("./plugins").TimeChartPlugin<import("./plugins/legend").Legend>;
        TimeChartZoomPlugin: typeof TimeChartZoomPlugin;
    };
    protected readonly _options: ResolvedOptions;
    get options(): ResolvedOptions;
    constructor(el: HTMLElement, options?: TimeChartOptions<TPlugins>);
}
export {};
