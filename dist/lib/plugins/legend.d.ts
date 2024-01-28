import { RenderModel } from "../core/renderModel";
import { ResolvedCoreOptions, TimeChartSeriesOptions } from "../options";
import { TimeChartPlugin } from ".";
export declare class Legend {
    private el;
    private model;
    private options;
    legend: HTMLElement;
    items: Map<TimeChartSeriesOptions, {
        item: HTMLElement;
        example: HTMLElement;
    }>;
    itemContainer: Node;
    constructor(el: HTMLElement, model: RenderModel, options: ResolvedCoreOptions);
    update(): void;
}
export declare const legend: TimeChartPlugin<Legend>;
