import { rgb } from 'd3-color';

import { RenderModel, DataPoint } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';
import { TimeChartOptions, TimeChartSeriesOptions, ResolvedOptions, ZoomOptions, ResolvedZoomOptions } from './options';
import { CanvasLayer } from './canvasLayer';
import { SVGLayer } from './svgLayer';
import { ChartZoom } from './chartZoom';

const defaultOptions = {
    lineWidth: 1,
    backgroundColor: rgb(255, 255, 255, 1),
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 45,
    paddingBottom: 20,
    xRange: 'auto',
    yRange: 'auto',
    realTime: false,
    baseTime: 0,
} as const;

const defaultSeriesOptions = {
    color: rgb(0, 0, 0, 1),
    name: '',
} as const;

export default class TimeChart {
    public options: ResolvedOptions;

    private model: RenderModel;
    private lineChartRenderer: LineChartRenderer;

    private canvasLayer: CanvasLayer;
    private svgLayer: SVGLayer;

    constructor(private el: HTMLElement, options?: TimeChartOptions) {
        options = options ?? {};
        const series: TimeChartSeriesOptions[] = options.series?.map(s => ({
            data: [] as DataPoint[],
            ...defaultSeriesOptions,
            ...s,
        })) ?? [];
        const renderOptions = {
            ...defaultOptions,
            ...options,
            series,
        };

        this.model = new RenderModel(renderOptions);
        this.canvasLayer = new CanvasLayer(el, renderOptions, this.model);
        this.svgLayer = new SVGLayer(el, renderOptions, this.model);
        this.lineChartRenderer = new LineChartRenderer(this.model, this.canvasLayer.gl, renderOptions);

        this.options = Object.assign(renderOptions, {
            zoom: this.registerZoom(options.zoom)
        });
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }

    private registerZoom(zoomOptions: ZoomOptions | undefined) {
        if (zoomOptions) {
            const z = new ChartZoom(this.el, {
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
        const canvas = this.canvasLayer.canvas;
        this.model.resize(canvas.clientWidth, canvas.clientHeight);
        this.svgLayer.onResize();
        this.canvasLayer.onResize();
        this.lineChartRenderer.onResize(canvas.clientWidth, canvas.clientHeight);
        this.update();
    }

    update() {
        this.model.requestRedraw();
    }
}
