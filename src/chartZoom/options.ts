import { ScaleLinear } from "d3-scale";

export enum DIRECTION {
    UNKNOWN, X, Y,
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
}

export interface ChartZoomOptions {
    x?: AxisOptions;
    y?: AxisOptions;
    panMouseButtons?: number;
}

export interface CapableElement extends Element, ElementCSSInlineStyle {
    addEventListener<K extends keyof GlobalEventHandlersEventMap>(type: K, listener: (this: CapableElement, ev: GlobalEventHandlersEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
};

export function dirOptions(options: ResolvedOptions) {
    return [
        { dir: DIRECTION.X, op: options.x },
        { dir: DIRECTION.Y, op: options.y },
    ].filter(i => i.op !== undefined) as {dir: DIRECTION.X | DIRECTION.Y, op: ResolvedAxisOptions}[];
}
