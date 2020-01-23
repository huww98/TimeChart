import { rgb } from 'd3-color';

import { RenderModel, DataPoint } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';
import { TimeChartOptions, resolveColorRGBA, TimeChartSeriesOptions } from './options';
import { CanvasLayer } from './canvasLayer';
import { SVGLayer } from './svgLayer';

const defaultOptions: TimeChartOptions = {
    lineWidth: 1,
    backgroundColor: rgb(255, 255, 255, 1),
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 45,
    paddingBottom: 20,
    xRange: 'auto',
    yRange: 'auto',
    realTime: false,
};

const defaultSeriesOptions: TimeChartSeriesOptions = {
    lineWidth: 1,
    color: rgb(0, 0, 0, 1),
    name: '',
};

export default class TimeChart {
    private options: TimeChartOptions;
    private renderModel: RenderModel;
    private lineChartRenderer: LineChartRenderer;

    private canvasLayer: CanvasLayer;
    private svgLayer: SVGLayer;

    constructor(private el: HTMLElement, options?: Partial<TimeChartOptions>) {
        const resolvedOptions = {
            ...defaultOptions,
            ...options,
        }
        this.options = resolvedOptions;

        this.renderModel = new RenderModel(resolvedOptions);
        this.canvasLayer = new CanvasLayer(el, resolvedOptions);
        this.svgLayer = new SVGLayer(el, resolvedOptions, this.renderModel);
        this.lineChartRenderer = new LineChartRenderer(this.renderModel, this.canvasLayer.gl);

        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        const canvas = this.canvasLayer.canvas;
        this.renderModel.onResize(canvas.clientWidth, canvas.clientHeight);
        this.svgLayer.onResize();
        this.canvasLayer.onResize();
        this.lineChartRenderer.onResize(canvas.clientWidth, canvas.clientHeight);
    }

    update() {
        this.canvasLayer.clear();
        this.renderModel.update();
        this.svgLayer.update();
        this.lineChartRenderer.drawFrame();
    }

    addDataSeries(data: DataPoint[], options?: Partial<TimeChartSeriesOptions>) {
        const resolvedOptions = {
            ...defaultSeriesOptions,
            ...options,
        }
        this.renderModel.series.push({
            data,
            options: resolvedOptions,
            yRangeUpdatedIndex: 0,
        });
    }
}
