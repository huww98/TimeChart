import { ColorSpaceObject, ColorCommonInstance, rgb } from 'd3-color';
import { DataPoint } from './renderModel';

type ColorSpecifier = ColorSpaceObject | ColorCommonInstance | string

interface AxisZoomOptions {
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

interface TimeChartRenderOptions {
    pixelRatio: number;
    lineWidth: number;
    backgroundColor: ColorSpecifier;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;

    xRange: { min: number | Date, max: number | Date } | 'auto' | null;
    yRange: { min: number, max: number } | 'auto' | null;
    realTime: boolean;

    /** Milliseconds since `new Date(0)`. Every x in data are relative to this.
     *
     * Set this option and keep the absolute value of x small for higher floating point precision.
     **/
    baseTime: number;

    debugWebGL: boolean;
    forceWebGL1: boolean;
}

interface TimeChartOptionsBase extends TimeChartRenderOptions {
}

export interface TimeChartOptions extends Partial<TimeChartOptionsBase> {
    series?: Partial<TimeChartSeriesOptions>[];
    zoom?: ZoomOptions;
}

export interface ResolvedRenderOptions extends TimeChartRenderOptions {
    series: TimeChartSeriesOptions[];
}

export interface ResolvedOptions extends ResolvedRenderOptions {
    zoom?: ResolvedZoomOptions;
}

export interface TimeChartSeriesOptions {
    data: DataPoint[];
    lineWidth?: number;
    name: string;
    color: ColorSpecifier;
    visible: boolean;
    _complete: true;
}

export function resolveColorRGBA(color: ColorSpecifier): [number, number, number, number] {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}
