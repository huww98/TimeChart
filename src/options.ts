import { ColorSpaceObject, ColorCommonInstance, rgb } from 'd3-color';
import { DataPoint } from './renderModel';

type ColorSpecifier = ColorSpaceObject | ColorCommonInstance | string

interface TimeChartOptionsBase {
    lineWidth: number;
    backgroundColor: ColorSpecifier;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;

    xRange: { min: number | Date, max: number | Date } | 'auto' | null;
    yRange: { min: number, max: number } | 'auto' | null;
    realTime: boolean;
    zoom: boolean;

    /** Milliseconds since `new Date(0)`. Every x in data are relative to this.
     *
     * Set this option and keep the absolute value of x small for higher floating point precision.
     **/
    baseTime: number;
}

export interface TimeChartOptions extends Partial<TimeChartOptionsBase> {
    series?: Partial<TimeChartSeriesOptions>[];
}

export interface ResolvedOptions extends TimeChartOptionsBase {
    series: TimeChartSeriesOptions[];
}

export interface TimeChartSeriesOptions {
    data: DataPoint[];
    lineWidth?: number;
    name: string;
    color: ColorSpecifier;
}

export function resolveColorRGBA(color: ColorSpecifier): [number, number, number, number] {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}
