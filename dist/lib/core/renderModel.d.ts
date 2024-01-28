import { ResolvedCoreOptions } from '../options';
import { EventDispatcher } from '../utils';
export interface DataPoint {
    x: number;
    y: number;
}
export interface MinMax {
    min: number;
    max: number;
}
export declare class RenderModel {
    private options;
    xScale: import("d3-scale").ScaleLinear<number, number, never>;
    yScale: import("d3-scale").ScaleLinear<number, number, never>;
    xRange: MinMax | null;
    yRange: MinMax | null;
    constructor(options: ResolvedCoreOptions);
    resized: EventDispatcher<(width: number, height: number) => void>;
    resize(width: number, height: number): void;
    updated: EventDispatcher<() => void>;
    disposing: EventDispatcher<() => void>;
    readonly abortController: AbortController;
    dispose(): void;
    update(): void;
    updateModel(): void;
    private redrawRequested;
    requestRedraw(): void;
    pxPoint(dataPoint: DataPoint): {
        x: number;
        y: number;
    };
}
