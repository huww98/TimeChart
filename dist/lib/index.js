import core from './core';
import { LineType } from './options';
import { TimeChartZoomPlugin } from './plugins/chartZoom';
import { crosshair } from './plugins/crosshair';
import { d3Axis } from './plugins/d3Axis';
import { legend } from './plugins/legend';
import { lineChart } from './plugins/lineChart';
import { nearestPoint } from './plugins/nearestPoint';
import { TimeChartTooltipPlugin } from './plugins/tooltip';
function addDefaultPlugins(options) {
    var _a;
    const o = options !== null && options !== void 0 ? options : { plugins: undefined, zoom: undefined, tooltip: undefined };
    return Object.assign(Object.assign({}, options), { plugins: Object.assign({ lineChart,
            d3Axis,
            crosshair,
            nearestPoint,
            legend, zoom: new TimeChartZoomPlugin(o.zoom), tooltip: new TimeChartTooltipPlugin(o.tooltip) }, ((_a = o.plugins) !== null && _a !== void 0 ? _a : {})) });
}
class TimeChart extends core {
    get options() { return this._options; }
    constructor(el, options) {
        super(el, addDefaultPlugins(options));
        this.el = el;
    }
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
    TimeChartTooltipPlugin,
};
TimeChart.LineType = LineType;
export default TimeChart;
//# sourceMappingURL=index.js.map