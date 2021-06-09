import { NoPlugin, ResolvedCoreOptions, TimeChartOptions, TimeChartPlugins, TimeChartSeriesOptions } from '../options';
import { rgb } from 'd3-color';
import { scaleTime } from 'd3-scale';
import { TimeChartPlugin } from '../plugins';
import { CanvasLayer } from './canvasLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { NearestPointModel } from './nearestPoint';
import { DataPoint, RenderModel } from './renderModel';
import { SVGLayer } from './svgLayer';


const defaultOptions = {
    pixelRatio: window.devicePixelRatio,
    lineWidth: 1,
    backgroundColor: rgb(0, 0, 0, 0),
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 45,
    paddingBottom: 20,
    xRange: 'auto',
    yRange: 'auto',
    realTime: false,
    baseTime: 0,
    xScaleType: scaleTime,
    debugWebGL: false,
    forceWebGL1: false,
    legend: true,
} as const;

const defaultSeriesOptions = {
    name: '',
    visible: true,
} as const;

type TPluginStates<TPlugins> = { [P in keyof TPlugins]: TPlugins[P] extends TimeChartPlugin<infer TState> ? TState : never };

export default class TimeChart<TPlugins extends TimeChartPlugins=NoPlugin> {
    protected readonly _options: ResolvedCoreOptions;
    get options() { return this._options; }

    readonly model: RenderModel;
    readonly canvasLayer: CanvasLayer;
    readonly svgLayer: SVGLayer;
    readonly contentBoxDetector: ContentBoxDetector;
    readonly nearestPoint: NearestPointModel;
    readonly plugins: TPluginStates<TPlugins>;
    disposed = false;

    private completeSeriesOptions(s: Partial<TimeChartSeriesOptions>): TimeChartSeriesOptions {
        return {
            data: [] as DataPoint[],
            ...defaultSeriesOptions,
            color: getComputedStyle(this.el).getPropertyValue('color'),
            ...s,
            _complete: true,
        }
    }

    constructor(public el: HTMLElement, options?: TimeChartOptions<TPlugins>) {
        const o = options ?? {series: undefined, plugins: undefined};
        const series = o.series?.map(s => this.completeSeriesOptions(s)) ?? [];
        const coreOptions: ResolvedCoreOptions = {
            ...defaultOptions,
            ...options,
            series,
        };

        this.model = new RenderModel(coreOptions);
        const shadowRoot = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.innerText = `
:host {
    contain: size layout paint style;
    position: relative;
}`
        shadowRoot.appendChild(style);

        this.canvasLayer = new CanvasLayer(el, coreOptions, this.model);
        this.svgLayer = new SVGLayer(el, this.model);
        this.contentBoxDetector = new ContentBoxDetector(el, this.model, coreOptions);
        this.nearestPoint = new NearestPointModel(this.canvasLayer, this.model, coreOptions, this.contentBoxDetector);
        this._options = coreOptions

        if (o.plugins === undefined) {
            this.plugins = {} as TPluginStates<TPlugins>;
        } else {
            this.plugins = Object.fromEntries(
                Object.entries(o.plugins).map(([name, p]) => [name, p.apply(this)])
            ) as TPluginStates<TPlugins>;
        }

        this.onResize();

        const resizeHandler = () => this.onResize()
        window.addEventListener('resize', resizeHandler);
        this.model.disposing.on(() => {
            window.removeEventListener('resize', resizeHandler);
            shadowRoot.removeChild(style);
        })
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
            if (!s._complete) {
                this.options.series[i] = this.completeSeriesOptions(s);
            }
        }

        this.model.requestRedraw();
    }

    dispose() {
        this.model.dispose();
        this.disposed = true;
    }
}
