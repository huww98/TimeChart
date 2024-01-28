import { rgb } from 'd3-color';
export var LineType;
(function (LineType) {
    LineType[LineType["Line"] = 0] = "Line";
    LineType[LineType["Step"] = 1] = "Step";
    LineType[LineType["NativeLine"] = 2] = "NativeLine";
    LineType[LineType["NativePoint"] = 3] = "NativePoint";
})(LineType || (LineType = {}));
;
export function resolveColorRGBA(color) {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}
//# sourceMappingURL=options.js.map