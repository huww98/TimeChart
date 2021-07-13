import { ResolvedCoreOptions, TimeChartSeriesOptions } from '../options';
import { EventDispatcher } from '../utils';
import { CanvasLayer } from './canvasLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { RenderModel } from './renderModel';
export declare class NearestPointModel {
    private canvas;
    private model;
    private options;
    points: Map<TimeChartSeriesOptions, {
        x: number;
        y: number;
    }>;
    private lastX;
    updated: EventDispatcher<() => void>;
    constructor(canvas: CanvasLayer, model: RenderModel, options: ResolvedCoreOptions, detector: ContentBoxDetector);
    adjustPoints(): void;
}
