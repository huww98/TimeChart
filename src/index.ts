import core from '@/core';
import { NoPlugin, ResolvedOptions, TimeChartOptions, TimeChartPlugins } from './options';
import { TimeChartZoom, TimeChartZoomPlugin } from './plugins/chartZoom';
import { crosshair } from './plugins/crosshair';
import { d3Axis } from './plugins/d3Axis';
import { legend } from './plugins/legend';
import { lineChart } from './plugins/lineChart';
import { nearestPoint } from './plugins/nearestPoint';

type TDefaultPlugins = {
    lineChart: typeof lineChart,
    d3Axis: typeof d3Axis,
    crosshair: typeof crosshair,
    nearestPoint: typeof nearestPoint,
    legend: typeof legend,
    zoom: TimeChartZoomPlugin,
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
            zoom: new TimeChartZoomPlugin(o.zoom ?? {})
        }
    } as TimeChartOptions<TPlugins&TDefaultPlugins>;
}

export default class TimeChart<TPlugins extends TimeChartPlugins=NoPlugin> extends core<TPlugins & TDefaultPlugins> {
    protected readonly _options: ResolvedOptions;
    get options() { return this._options; }

    constructor(public el: HTMLElement, options?: TimeChartOptions<TPlugins>) {
        super(el, addDefaultPlugins<TPlugins>(options));
        const zoom = this.plugins.zoom as TimeChartZoom;
        this._options = Object.assign(super.options, {zoom: zoom.options});
    }
}
