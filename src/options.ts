import { ColorSpaceObject, ColorCommonInstance, rgb } from 'd3-color';

type ColorSpecifier = ColorSpaceObject | ColorCommonInstance | string

export interface TimeChartOptions {
    lineWidth: number;
    backgroundColor: ColorSpecifier;
}

export interface TimeChartSeriesOptions {
    lineWidth: number;
    name: string;
    color: ColorSpecifier;
}

export function resolveColorRGBA(color: ColorSpecifier): [number, number, number, number] {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}
