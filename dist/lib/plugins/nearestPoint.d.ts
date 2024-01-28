import { NearestPointModel } from "../core/nearestPoint";
import { SVGLayer } from "../core/svgLayer";
import { ResolvedCoreOptions } from "../options";
import { TimeChartPlugin } from ".";
import { RenderModel } from "../core/renderModel";
export declare class NearestPoint {
    private svg;
    private options;
    private model;
    private pModel;
    private intersectPoints;
    private container;
    constructor(svg: SVGLayer, options: ResolvedCoreOptions, model: RenderModel, pModel: NearestPointModel);
    adjustIntersectPoints(): void;
}
export declare const nearestPoint: TimeChartPlugin<NearestPoint>;
