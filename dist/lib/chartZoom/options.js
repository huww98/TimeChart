export var DIRECTION;
(function (DIRECTION) {
    DIRECTION[DIRECTION["UNKNOWN"] = 0] = "UNKNOWN";
    DIRECTION[DIRECTION["X"] = 1] = "X";
    DIRECTION[DIRECTION["Y"] = 2] = "Y";
})(DIRECTION || (DIRECTION = {}));
;
export function dirOptions(options) {
    return [
        { dir: DIRECTION.X, op: options.x },
        { dir: DIRECTION.Y, op: options.y },
    ].filter(i => i.op !== undefined);
}
//# sourceMappingURL=options.js.map