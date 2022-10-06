import core from './core';
import { LineType, NoPlugin, ResolvedOptions, TimeChartOptions, TimeChartPlugins } from './options';
import { TimeChartZoomPlugin } from './plugins/chartZoom';
import { crosshair } from './plugins/crosshair';
import { d3Axis } from './plugins/d3Axis';
import { legend } from './plugins/legend';
import { lineChart } from './plugins/lineChart';
import { nearestPoint } from './plugins/nearestPoint';
import { tooltip } from './plugins/tooltip';

type TDefaultPlugins = {
    lineChart: typeof lineChart,
    d3Axis: typeof d3Axis,
    crosshair: typeof crosshair,
    nearestPoint: typeof nearestPoint,
    legend: typeof legend,
    zoom: TimeChartZoomPlugin,
    tooltip: typeof tooltip
}

function addDefaultPlugins<TPlugins extends TimeChartPlugins=NoPlugin>(options?: TimeChartOptions<TPlugins>): TimeChartOptions<TPlugins&TDefaultPlugins> {
    const o = options ?? {plugins: undefined, zoom: undefined};
    return {
        ...options,
        plugins: {
            ...(o.plugins ?? {}) as TPlugins,
            lineChart,
            d3Axis,
            crosshair,
            nearestPoint,
            legend,
            zoom: new TimeChartZoomPlugin(o.zoom),
            tooltip
        }
    } as TimeChartOptions<TPlugins&TDefaultPlugins>;
}

export default class TimeChart<TPlugins extends TimeChartPlugins=NoPlugin> extends core<TPlugins & TDefaultPlugins> {
    // For users who use script tag
    static core = core;
    static plugins = {
        lineChart,
        d3Axis,
        crosshair,
        nearestPoint,
        legend,
        TimeChartZoomPlugin,
        tooltip
    }
    static LineType = LineType;

    get options(): ResolvedOptions { return this._options as ResolvedOptions; }

    constructor(public el: HTMLElement, options?: TimeChartOptions<TPlugins>) {
        super(el, addDefaultPlugins<TPlugins>(options));
    }
}
