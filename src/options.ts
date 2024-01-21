import { ColorCommonInstance, ColorSpaceObject, rgb } from 'd3-color';
import { DataPointsBuffer } from './core/dataPointsBuffer';
import { DataPoint } from './core/renderModel';
import { TimeChartPlugin } from './plugins';

type ColorSpecifier = ColorSpaceObject | ColorCommonInstance | string

export interface AxisZoomOptions {
    autoRange: boolean;
    minDomain: number;
    maxDomain: number;
    minDomainExtent: number;
    maxDomainExtent: number;
}

export interface ZoomOptions {
    x?: Partial<AxisZoomOptions>;
    y?: Partial<AxisZoomOptions>;
}

export interface ResolvedZoomOptions {
    x?: AxisZoomOptions;
    y?: AxisZoomOptions;
}

interface ScaleBase {
    (x: number | {valueOf(): number}): number;
    domain(): number[] | Date[];
    range(): number[];
    copy(): this;
    domain(domain: Array<number>): this;
    range(range: ReadonlyArray<number>): this;
}

export interface TooltipOptions {
    enabled: boolean;
    xLabel: string;
    xFormatter: (x: number) => string;
}

interface TimeChartRenderOptions {
    pixelRatio: number;
    lineWidth: number;
    backgroundColor: ColorSpecifier;
    color: ColorSpecifier;

    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;

    renderPaddingLeft: number;
    renderPaddingRight: number;
    renderPaddingTop: number;
    renderPaddingBottom: number;

    legend: boolean;
    tooltip: Partial<TooltipOptions>;

    xRange: { min: number | Date, max: number | Date } | 'auto' | null;
    yRange: { min: number, max: number } | 'auto' | null;
    realTime: boolean;

    /** Milliseconds since `new Date(0)`. Every x in data are relative to this.
     *
     * Set this option and keep the absolute value of x small for higher floating point precision.
     **/
    baseTime: number;
    xScaleType: () => ScaleBase;

    debugWebGL: boolean;
}

export type TimeChartPlugins = Readonly<Record<string, TimeChartPlugin>>;
export type NoPlugin = Readonly<Record<string, never>>;

export type TimeChartOptions<TPlugins extends TimeChartPlugins> =
    TimeChartOptionsBase &
    (NoPlugin extends TPlugins ? {plugins?: Record<string, never>} : {plugins: TPlugins});

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

export enum LineType {
    Line,
    Step,
    NativeLine,
    NativePoint,
};

export interface TimeChartSeriesOptions {
    data: DataPointsBuffer;
    lineWidth?: number;
    name: string;
    color?: ColorSpecifier;
    visible: boolean;
    lineType: LineType;
    stepLocation: number;

    /**
     * The expected interval of adjacent x values. Set this for higher WebGL rendering accuracy.
     * @default 0
     */
    xStep: number;
    /**
     * Whether to correct xStep to match the actual interval when a segment is fully filled.
     * @default true
     * @see xStep
     */
    xStepCorrection: boolean;
}

export function resolveColorRGBA(color: ColorSpecifier): [number, number, number, number] {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}
