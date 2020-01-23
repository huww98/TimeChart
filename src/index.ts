import { rgb } from 'd3-color';

import { RenderModel, DataPoint } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';
import { TimeChartOptions, resolveColorRGBA, TimeChartSeriesOptions } from './options';

const defaultOptions: TimeChartOptions = {
    lineWidth: 1,
    backgroundColor: rgb(0, 0, 0, 1),
};

const defaultSeriesOptions: TimeChartSeriesOptions = {
    lineWidth: 1,
    color: rgb(255, 255, 255, 1),
    name: '',
};

export default class TimeChart {
    private renderModel: RenderModel;
    private lineChartRenderer: LineChartRenderer;
    gl: WebGL2RenderingContext;
    canvas: HTMLCanvasElement;
    constructor(private el: HTMLElement, options?: Partial<TimeChartOptions>) {
        const resolvedOptions = {
            ...defaultOptions,
            ...options,
        }

        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        el.appendChild(canvas);

        const scale = window.devicePixelRatio;
        canvas.width = canvas.clientWidth * scale;
        canvas.height = canvas.clientHeight * scale;

        const ctx = canvas.getContext('webgl2');
        if (!ctx) {
            throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.');
        }
        const gl = ctx;

        const bgColor = resolveColorRGBA(resolvedOptions.backgroundColor);
        gl.clearColor(...bgColor);

        this.gl = gl;
        this.canvas = canvas
        this.renderModel = new RenderModel();
        this.lineChartRenderer = new LineChartRenderer(this.renderModel, gl);
        this.lineChartRenderer.onResize(canvas.clientWidth, canvas.clientHeight);
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        const scale = window.devicePixelRatio;
        const canvas = this.canvas;
        canvas.width = canvas.clientWidth * scale;
        canvas.height = canvas.clientHeight * scale;
        this.gl.viewport(0, 0, canvas.width, canvas.height);
        this.lineChartRenderer.onResize(canvas.clientWidth, canvas.clientHeight);
    }

    update() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);
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
        });
    }
}
