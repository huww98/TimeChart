import core from "../core";
import { TimeChartPlugin } from "../plugins";
export interface SelectZoomOptions {
    mouseButtons: number;
    enableX: boolean;
    enableY: boolean;
    cancelOnSecondPointer: boolean;
}
export declare class SelectZoom {
    private readonly chart;
    readonly options: SelectZoomOptions;
    private visual;
    constructor(chart: core, options: SelectZoomOptions);
    onKeyDown(ev: KeyboardEvent): void;
    private start;
    private reset;
    private getPoint;
    onMouseDown(ev: PointerEvent): void;
    onMouseMove(ev: PointerEvent): void;
    onMouseUp(ev: PointerEvent): void;
    onPointerCancel(ev: PointerEvent): void;
}
export declare class SelectZoomPlugin implements TimeChartPlugin<SelectZoom> {
    readonly options: SelectZoomOptions;
    constructor(options?: Partial<SelectZoomOptions>);
    apply(chart: core): SelectZoom;
}
