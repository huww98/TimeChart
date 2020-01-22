import { RenderModel } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';

export class TimeChart {
    renderModel: RenderModel;
    private lineChartRenderer: LineChartRenderer;
    constructor(private gl: WebGL2RenderingContext) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        this.renderModel = new RenderModel();
        this.lineChartRenderer = new LineChartRenderer(this.renderModel, gl);
    }

    update() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.lineChartRenderer.drawFrame();
    }
}
