import { rgb } from 'd3-color';

import { RenderModel, DataPoint } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';
import { TimeChartOptions, resolveColorRGBA, TimeChartSeriesOptions, ResolvedOptions } from './options';
import { CanvasLayer } from './canvasLayer';
import { SVGLayer } from './svgLayer';

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

    private renderModel: RenderModel;
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

        this.renderModel = new RenderModel(resolvedOptions);
        this.canvasLayer = new CanvasLayer(el, resolvedOptions, this.renderModel);
        this.svgLayer = new SVGLayer(el, resolvedOptions, this.renderModel);
        this.lineChartRenderer = new LineChartRenderer(this.renderModel, this.canvasLayer.gl, resolvedOptions);

        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        const canvas = this.canvasLayer.canvas;
        this.renderModel.resize(canvas.clientWidth, canvas.clientHeight);
        this.svgLayer.onResize();
        this.canvasLayer.onResize();
        this.lineChartRenderer.onResize(canvas.clientWidth, canvas.clientHeight);
    }

    update() {
        this.renderModel.requestRedraw();
    }
}
