import { RenderModel } from "../core/renderModel";
import { ResolvedCoreOptions } from '../options';
import { TimeChartPlugin } from '.';
export declare class LineChartRenderer {
    private model;
    private gl;
    private options;
    private lineProgram;
    private nativeLineProgram;
    private uniformBuffer;
    private arrays;
    private height;
    private width;
    private renderHeight;
    private renderWidth;
    constructor(model: RenderModel, gl: WebGL2RenderingContext, options: ResolvedCoreOptions);
    syncBuffer(): void;
    syncViewport(): void;
    onResize(width: number, height: number): void;
    drawFrame(): void;
    syncDomain(): void;
}
export declare const lineChart: TimeChartPlugin<LineChartRenderer>;
