import { RenderModel } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';

export class TimeChart {
    renderModel: RenderModel;
    private lineChartRenderer: LineChartRenderer;
    constructor(private gl: WebGL2RenderingContext) {
        this.renderModel = new RenderModel();
        this.lineChartRenderer = new LineChartRenderer(this.renderModel, gl);
    }

    update() {
        this.lineChartRenderer.drawFrame()
    }
}
