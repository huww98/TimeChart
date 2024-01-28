import { CapableElement, ChartZoomOptions, ResolvedOptions } from "./options";
export declare const defaultAxisOptions: {
    readonly minDomain: number;
    readonly maxDomain: number;
    readonly minDomainExtent: 0;
    readonly maxDomainExtent: number;
};
export declare const defaultOptions: {
    readonly panMouseButtons: number;
    readonly touchMinPoints: 1;
};
export declare class ChartZoom {
    options: ResolvedOptions;
    private touch;
    private mouse;
    private wheel;
    private scaleUpdated;
    constructor(el: CapableElement, options?: ChartZoomOptions);
    onScaleUpdated(callback: () => void): void;
    /** Call this when scale updated outside */
    update(): void;
}
