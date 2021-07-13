import { ColorCommonInstance, ColorSpaceObject } from 'd3-color';
import * as zoomOptions from './chartZoom/options';
import { DataPoint } from './core/renderModel';
import { TimeChartPlugin } from './plugins';
declare type ColorSpecifier = ColorSpaceObject | ColorCommonInstance | string;
interface AxisZoomOptions {
    autoRange: boolean;
    minDomain: number;
    maxDomain: number;
    minDomainExtent: number;
    maxDomainExtent: number;
}
export interface ResolvedAxisZoomOptions extends zoomOptions.ResolvedAxisOptions {
    autoRange: boolean;
}
export interface ZoomOptions {
    x?: Partial<AxisZoomOptions>;
    y?: Partial<AxisZoomOptions>;
}
export interface ResolvedZoomOptions {
    x?: ResolvedAxisZoomOptions;
    y?: ResolvedAxisZoomOptions;
}
interface ScaleBase {
    (x: number | {
        valueOf(): number;
    }): number;
    domain(): number[] | Date[];
    range(): number[];
    copy(): this;
    domain(domain: Array<number>): this;
    range(range: ReadonlyArray<number>): this;
}
interface TimeChartRenderOptions {
    pixelRatio: number;
    lineWidth: number;
    backgroundColor: ColorSpecifier;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;
    legend: boolean;
    xRange: {
        min: number | Date;
        max: number | Date;
    } | 'auto' | null;
    yRange: {
        min: number;
        max: number;
    } | 'auto' | null;
    realTime: boolean;
    /** Milliseconds since `new Date(0)`. Every x in data are relative to this.
     *
     * Set this option and keep the absolute value of x small for higher floating point precision.
     **/
    baseTime: number;
    xScaleType: () => ScaleBase;
    debugWebGL: boolean;
    forceWebGL1: boolean;
}
export declare type TimeChartPlugins = Readonly<Record<string, TimeChartPlugin>>;
export declare type NoPlugin = Readonly<Record<string, never>>;
export declare type TimeChartOptions<TPlugins extends TimeChartPlugins> = TimeChartOptionsBase & (NoPlugin extends TPlugins ? {
    plugins?: Record<string, never>;
} : {
    plugins: TPlugins;
});
export interface TimeChartOptionsBase extends Partial<TimeChartRenderOptions> {
    series?: Partial<TimeChartSeriesOptions>[];
    zoom?: ZoomOptions;
}
export interface ResolvedCoreOptions extends TimeChartRenderOptions {
    series: TimeChartSeriesOptions[];
}
export interface ResolvedOptions extends ResolvedCoreOptions {
    zoom: ResolvedZoomOptions;
}
export interface TimeChartSeriesOptions {
    data: DataPoint[];
    lineWidth?: number;
    name: string;
    color: ColorSpecifier;
    visible: boolean;
    _complete: true;
}
export declare function resolveColorRGBA(color: ColorSpecifier): [number, number, number, number];
export {};
