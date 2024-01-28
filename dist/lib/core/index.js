import { LineType } from '../options';
import { rgb } from 'd3-color';
import { scaleTime } from 'd3-scale';
import { CanvasLayer } from './canvasLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { NearestPointModel } from './nearestPoint';
import { RenderModel } from './renderModel';
import { SVGLayer } from './svgLayer';
import { DataPointsBuffer } from './dataPointsBuffer';
const defaultOptions = {
    pixelRatio: window.devicePixelRatio,
    lineWidth: 1,
    backgroundColor: rgb(0, 0, 0, 0),
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 45,
    paddingBottom: 20,
    renderPaddingTop: 0,
    renderPaddingRight: 0,
    renderPaddingLeft: 0,
    renderPaddingBottom: 0,
    xRange: 'auto',
    yRange: 'auto',
    realTime: false,
    baseTime: 0,
    xScaleType: scaleTime,
    debugWebGL: false,
    forceWebGL1: false,
    legend: true,
};
const defaultSeriesOptions = {
    name: '',
    color: null,
    visible: true,
    lineType: LineType.Line,
    stepLocation: 1.,
};
function completeSeriesOptions(s) {
    s.data = s.data ? DataPointsBuffer._from_array(s.data) : new DataPointsBuffer();
    Object.setPrototypeOf(s, defaultSeriesOptions);
    return s;
}
function completeOptions(el, options) {
    const dynamicDefaults = {
        series: [],
        color: getComputedStyle(el).getPropertyValue('color'),
    };
    const o = Object.assign({}, dynamicDefaults, options);
    o.series = o.series.map(s => completeSeriesOptions(s));
    Object.setPrototypeOf(o, defaultOptions);
    return o;
}
export default class TimeChart {
    get options() { return this._options; }
    constructor(el, options) {
        var _a, _b;
        this.el = el;
        this.disposed = false;
        const coreOptions = completeOptions(el, options);
        this.model = new RenderModel(coreOptions);
        const shadowRoot = (_a = el.shadowRoot) !== null && _a !== void 0 ? _a : el.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.innerText = `
:host {
    contain: size layout paint style;
    position: relative;
}`;
        shadowRoot.appendChild(style);
        this.canvasLayer = new CanvasLayer(el, coreOptions, this.model);
        this.svgLayer = new SVGLayer(el, this.model);
        this.contentBoxDetector = new ContentBoxDetector(el, this.model, coreOptions);
        this.nearestPoint = new NearestPointModel(this.canvasLayer, this.model, coreOptions, this.contentBoxDetector);
        this._options = coreOptions;
        this.plugins = Object.fromEntries(Object.entries((_b = options === null || options === void 0 ? void 0 : options.plugins) !== null && _b !== void 0 ? _b : {}).map(([name, p]) => [name, p.apply(this)]));
        this.onResize();
        const resizeHandler = () => this.onResize();
        window.addEventListener('resize', resizeHandler);
        this.model.disposing.on(() => {
            window.removeEventListener('resize', resizeHandler);
            shadowRoot.removeChild(style);
        });
    }
    onResize() {
        this.model.resize(this.el.clientWidth, this.el.clientHeight);
    }
    update() {
        if (this.disposed) {
            throw new Error('Cannot update after dispose.');
        }
        // fix dynamic added series
        for (let i = 0; i < this.options.series.length; i++) {
            const s = this.options.series[i];
            if (!defaultSeriesOptions.isPrototypeOf(s)) {
                this.options.series[i] = completeSeriesOptions(s);
            }
        }
        this.model.requestRedraw();
    }
    dispose() {
        this.model.dispose();
        this.disposed = true;
    }
}
//# sourceMappingURL=index.js.map