import { RenderModel } from "../core/renderModel";
import { ResolvedCoreOptions } from '../options';
import { TimeChartPlugin } from '.';
export declare class LineChartRenderer {
    private model;
    private gl;
    private options;
    private program;
    private arrays;
    private height;
    private width;
    constructor(model: RenderModel, gl: WebGL2RenderingContext | WebGLRenderingContext, options: ResolvedCoreOptions);
    syncBuffer(): void;
    onResize(width: number, height: number): void;
    drawFrame(): void;
    private ySvgToView;
    private xSvgToView;
    syncDomain(): void;
}
export declare const lineChart: TimeChartPlugin<LineChartRenderer>;
