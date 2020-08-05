import { rgb } from 'd3-color';

import { RenderModel, DataPoint } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';
import { TimeChartOptions, TimeChartSeriesOptions, ResolvedOptions, ZoomOptions, ResolvedZoomOptions, ResolvedRenderOptions } from './options';
import { CanvasLayer } from './canvasLayer';
import { SVGLayer } from './svgLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { ChartZoom } from './chartZoom';
import { D3AxisRenderer } from './d3AxisRenderer';
import { Legend } from './legend';
import { Crosshair } from './crosshair';
import { NearestPoint, NearestPointModel } from './nearestPoint';
import { CapableElement as ZoomableElement } from './chartZoom/options';

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
    debugWebGL: false,
    forceWebGL1: false,
} as const;

const defaultSeriesOptions = {
    name: '',
    visible: true,
} as const;

export default class TimeChart {
    public options: ResolvedOptions;

    private model: RenderModel;
    private disposed = false;

    private completeSeriesOptions(s: Partial<TimeChartSeriesOptions>): TimeChartSeriesOptions {
        return {
            data: [] as DataPoint[],
            ...defaultSeriesOptions,
            color: getComputedStyle(this.el).getPropertyValue('color'),
            ...s,
            _complete: true,
        }
    }

    constructor(private el: HTMLElement, options?: TimeChartOptions) {
        options = options ?? {};
        const series = options.series?.map(s => this.completeSeriesOptions(s)) ?? [];
        const renderOptions: ResolvedRenderOptions = {
            ...defaultOptions,
            ...options,
            series,
        };

        this.model = new RenderModel(renderOptions);
        const shadowRoot = el.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.innerText = `
:host {
    contain: size layout paint style;
    position: relative;
}`
        shadowRoot.appendChild(style);

        const canvasLayer = new CanvasLayer(el, renderOptions, this.model);
        const lineChartRenderer = new LineChartRenderer(this.model, canvasLayer.gl, renderOptions);

        const svgLayer = new SVGLayer(el, this.model);
        const contentBoxDetector = new ContentBoxDetector(el, this.model, renderOptions);
        const axisRenderer = new D3AxisRenderer(this.model, svgLayer.svgNode, renderOptions);
        const legend = new Legend(el, this.model, renderOptions);
        const crosshair = new Crosshair(svgLayer, this.model, renderOptions, contentBoxDetector);
        const nearestPointModel = new NearestPointModel(canvasLayer, this.model, renderOptions, contentBoxDetector);
        const nearestPoint = new NearestPoint(svgLayer, renderOptions, nearestPointModel);

        this.options = Object.assign(renderOptions, {
            zoom: this.registerZoom(contentBoxDetector.node, options.zoom)
        });
        this.onResize();

        const resizeHandler = () => this.onResize()
        window.addEventListener('resize', resizeHandler);
        this.model.disposing.on(() => {
            window.removeEventListener('resize', resizeHandler);
            shadowRoot.removeChild(style);
        })
    }

    private registerZoom(el: ZoomableElement, zoomOptions: ZoomOptions | undefined) {
        if (zoomOptions) {
            const z = new ChartZoom(el, {
                x: zoomOptions.x && {
                    ...zoomOptions.x,
                    scale: this.model.xScale,
                },
                y: zoomOptions.y && {
                    ...zoomOptions.y,
                    scale: this.model.yScale,
                }
            });
            const resolvedOptions = z.options as ResolvedZoomOptions
            this.model.updated.on(() => {
                const dirs = [
                    [resolvedOptions.x, this.model.xScale, this.model.xRange],
                    [resolvedOptions.y, this.model.yScale, this.model.yRange],
                ] as const;
                for (const [op, scale, range] of dirs) {
                    if (!op?.autoRange) {
                        continue;
                    }
                    let [min, max] = scale.domain();
                    if (range) {
                        min = Math.min(min, range.min);
                        max = Math.max(max, range.max);
                    }
                    op.minDomain = min;
                    op.maxDomain = max;
                }
                z.update();
            });
            z.onScaleUpdated(() => {
                this.options.xRange = null;
                this.options.yRange = null;
                this.options.realTime = false;
                this.update();
            });
            return resolvedOptions;
        }
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
