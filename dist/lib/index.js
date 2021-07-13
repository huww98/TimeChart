import core from './core';
import { TimeChartZoomPlugin } from './plugins/chartZoom';
import { crosshair } from './plugins/crosshair';
import { d3Axis } from './plugins/d3Axis';
import { legend } from './plugins/legend';
import { lineChart } from './plugins/lineChart';
import { nearestPoint } from './plugins/nearestPoint';
function addDefaultPlugins(options) {
    const o = options ?? { plugins: undefined, zoom: undefined };
    return {
        ...options,
        plugins: {
            ...(o.plugins ?? {}),
            lineChart,
            d3Axis,
            crosshair,
            nearestPoint,
            legend,
            zoom: new TimeChartZoomPlugin(o.zoom ?? {})
        }
    };
}
export default class TimeChart extends core {
    constructor(el, options) {
        super(el, addDefaultPlugins(options));
        this.el = el;
        const zoom = this.plugins.zoom;
        this._options = Object.assign(super.options, { zoom: zoom.options });
    }
    get options() { return this._options; }
}
// For users who use script tag
TimeChart.core = core;
TimeChart.plugins = {
    lineChart,
    d3Axis,
    crosshair,
    nearestPoint,
    legend,
    TimeChartZoomPlugin,
};
//# sourceMappingURL=index.js.map