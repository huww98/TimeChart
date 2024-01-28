import { NoPlugin, ResolvedCoreOptions, TimeChartOptions, TimeChartPlugins } from '../options';
import { TimeChartPlugin } from '../plugins';
import { CanvasLayer } from './canvasLayer';
import { ContentBoxDetector } from "./contentBoxDetector";
import { NearestPointModel } from './nearestPoint';
import { RenderModel } from './renderModel';
import { SVGLayer } from './svgLayer';
type TPluginStates<TPlugins> = {
    [P in keyof TPlugins]: TPlugins[P] extends TimeChartPlugin<infer TState> ? TState : never;
};
export default class TimeChart<TPlugins extends TimeChartPlugins = NoPlugin> {
    el: HTMLElement;
    protected readonly _options: ResolvedCoreOptions;
    get options(): ResolvedCoreOptions;
    readonly model: RenderModel;
    readonly canvasLayer: CanvasLayer;
    readonly svgLayer: SVGLayer;
    readonly contentBoxDetector: ContentBoxDetector;
    readonly nearestPoint: NearestPointModel;
    readonly plugins: TPluginStates<TPlugins>;
    disposed: boolean;
    constructor(el: HTMLElement, options?: TimeChartOptions<TPlugins>);
    onResize(): void;
    update(): void;
    dispose(): void;
}
export {};
