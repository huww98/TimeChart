import { rgb } from 'd3-color';

import { RenderModel, DataPoint } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';
import { TimeChartOptions, resolveColorRGBA, TimeChartSeriesOptions, ResolvedOptions } from './options';
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
    zoom: true,
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
        const series: TimeChartSeriesOptions[] = options?.series?.map(s => ({
            data: [] as DataPoint[],
            ...defaultSeriesOptions,
            ...s,
        })) ?? [];
        const resolvedOptions: ResolvedOptions = {
            ...defaultOptions,
            ...options,
            series,
        }
        this.options = resolvedOptions;

        this.model = new RenderModel(resolvedOptions);
        this.canvasLayer = new CanvasLayer(el, resolvedOptions, this.model);
        this.svgLayer = new SVGLayer(el, resolvedOptions, this.model);
        this.lineChartRenderer = new LineChartRenderer(this.model, this.canvasLayer.gl, resolvedOptions);

        this.onResize();
        window.addEventListener('resize', () => this.onResize());
        this.registerZoom();
    }

    private registerZoom() {
        if (this.options.zoom) {
            const DAY = 24 * 3600 * 1000;
            const z = new ChartZoom(this.el, {
                x: {
                    scale: this.model.xScale,
                    minDomain: -60 * 1000,
                    maxDomain: 10 * 365 * DAY,
                    minDomainExtent: 50,
                    maxDomainExtent: 1 * 365 * DAY,
                }
            })
            this.model.onUpdate(() => z.update());
            z.onScaleUpdated(() => {
                this.options.xRange = null;
                this.options.realTime = false;
                this.update();
            });
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
