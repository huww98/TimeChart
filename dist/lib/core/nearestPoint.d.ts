import { ResolvedCoreOptions, TimeChartSeriesOptions } from '../options';
import { EventDispatcher } from '../utils';
import { CanvasLayer } from './canvasLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { DataPoint, RenderModel } from './renderModel';
export declare class NearestPointModel {
    private canvas;
    private model;
    private options;
    dataPoints: Map<TimeChartSeriesOptions, DataPoint>;
    lastPointerPos: null | {
        x: number;
        y: number;
    };
    updated: EventDispatcher<() => void>;
    constructor(canvas: CanvasLayer, model: RenderModel, options: ResolvedCoreOptions, detector: ContentBoxDetector);
    adjustPoints(): void;
}
