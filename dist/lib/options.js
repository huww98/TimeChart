import { rgb } from 'd3-color';
export function resolveColorRGBA(color) {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}
//# sourceMappingURL=options.js.map