import { RenderModel } from './renderModel';
import { LineChartRenderer } from './lineChartRenderer';

export class TimeChart {
    private renderModel: RenderModel;
    private lineChartRenderer: LineChartRenderer;
    constructor(private gl: WebGL2RenderingContext) {
        this.renderModel = new RenderModel();
        this.renderModel.dataPoints.push(
            {x: 0, y: 0},
            {x: 50, y: 120},
            {x: 100, y: 640},
            {x: 150, y: 3},
            {x: 200, y: 320},
            {x: 250, y: 320},
        )
        this.lineChartRenderer = new LineChartRenderer(this.renderModel, gl);
    }
}
