import { ResolvedCoreOptions } from '../options';
import { RenderModel } from './renderModel';
export declare class CanvasLayer {
    private options;
    canvas: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    constructor(el: HTMLElement, options: ResolvedCoreOptions, model: RenderModel);
    syncViewport(): void;
    onResize(width: number, height: number): void;
    clear(): void;
}
