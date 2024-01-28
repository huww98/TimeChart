import { ChartZoom } from "../chartZoom";
export class TimeChartZoom {
    constructor(chart, options) {
        this.options = options;
        this.registerZoom(chart);
    }
    applyAutoRange(o, dataRange) {
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
    registerZoom(chart) {
        const o = this.options;
        const z = new ChartZoom(chart.el, o);
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
const defaults = {
    autoRange: true,
};
export class TimeChartZoomPlugin {
    constructor(options) {
        this.options = options;
    }
    resolveOptions(chart) {
        var _a;
        const o = (_a = this.options) !== null && _a !== void 0 ? _a : {};
        return new Proxy(o, {
            get: (target, prop) => {
                switch (prop) {
                    case 'x':
                    case 'y':
                        const op = target[prop];
                        if (!op)
                            return op;
                        return new Proxy(op, {
                            get: (target, prop2) => {
                                var _a;
                                if (prop2 === 'scale') {
                                    switch (prop) {
                                        case 'x':
                                            return chart.model.xScale;
                                        case 'y':
                                            return chart.model.yScale;
                                    }
                                }
                                return (_a = target[prop2]) !== null && _a !== void 0 ? _a : defaults[prop2];
                            }
                        });
                    case 'eventElement':
                        return chart.contentBoxDetector.node;
                    default:
                        return target[prop];
                }
            }
        });
    }
    apply(chart) {
        return new TimeChartZoom(chart, this.resolveOptions(chart));
    }
}
//# sourceMappingURL=chartZoom.js.map