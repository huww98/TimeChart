import { NearestPointModel } from "../core/nearestPoint";
import { SVGLayer } from "../core/svgLayer";
import { ResolvedCoreOptions } from "../options";
import { TimeChartPlugin } from ".";
export declare class NearestPoint {
    private svg;
    private options;
    private pModel;
    private intersectPoints;
    private container;
    constructor(svg: SVGLayer, options: ResolvedCoreOptions, pModel: NearestPointModel);
    adjustIntersectPoints(): void;
}
export declare const nearestPoint: TimeChartPlugin<NearestPoint>;
