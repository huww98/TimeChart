import { ScaleLinear } from "d3-scale";
export declare enum DIRECTION {
    UNKNOWN = 0,
    X = 1,
    Y = 2
}
export interface Point {
    [DIRECTION.X]: number;
    [DIRECTION.Y]: number;
}
export interface AxisOptions {
    scale: ScaleLinear<number, number>;
    minDomain?: number;
    maxDomain?: number;
    minDomainExtent?: number;
    maxDomainExtent?: number;
}
export interface ResolvedAxisOptions {
    scale: ScaleLinear<number, number>;
    minDomain: number;
    maxDomain: number;
    minDomainExtent: number;
    maxDomainExtent: number;
}
export interface ResolvedOptions {
    x?: ResolvedAxisOptions;
    y?: ResolvedAxisOptions;
    panMouseButtons: number;
    touchMinPoints: number;
    eventElement: CapableElement;
}
export interface ChartZoomOptions {
    x?: AxisOptions;
    y?: AxisOptions;
    panMouseButtons?: number;
    touchMinPoints?: number;
    eventElement?: CapableElement;
}
export interface CapableElement extends Element, ElementCSSInlineStyle {
    addEventListener<K extends keyof GlobalEventHandlersEventMap>(type: K, listener: (this: CapableElement, ev: GlobalEventHandlersEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
}
export declare function dirOptions(options: ResolvedOptions): {
    dir: DIRECTION.X | DIRECTION.Y;
    op: ResolvedAxisOptions;
}[];
