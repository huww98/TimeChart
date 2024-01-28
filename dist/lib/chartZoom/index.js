import { EventDispatcher } from '../utils';
import { ChartZoomMouse } from './mouse';
import { ChartZoomTouch } from './touch';
import { ChartZoomWheel } from './wheel';
export const defaultAxisOptions = {
    minDomain: -Infinity,
    maxDomain: Infinity,
    minDomainExtent: 0,
    maxDomainExtent: Infinity,
};
export const defaultOptions = {
    panMouseButtons: 1 | 2 | 4,
    touchMinPoints: 1,
};
export class ChartZoom {
    constructor(el, options) {
        this.scaleUpdated = new EventDispatcher();
        options = options !== null && options !== void 0 ? options : {};
        this.options = new Proxy(options, {
            get(target, prop) {
                var _a, _b;
                if (prop === 'x' || prop === 'y') {
                    const op = target[prop];
                    if (!op)
                        return op;
                    return new Proxy(op, {
                        get(target, prop) {
                            var _a;
                            return (_a = target[prop]) !== null && _a !== void 0 ? _a : defaultAxisOptions[prop];
                        }
                    });
                }
                if (prop === 'eventElement') {
                    return (_a = target[prop]) !== null && _a !== void 0 ? _a : el;
                }
                return (_b = target[prop]) !== null && _b !== void 0 ? _b : defaultOptions[prop];
            }
        });
        this.touch = new ChartZoomTouch(el, this.options);
        this.mouse = new ChartZoomMouse(el, this.options);
        this.wheel = new ChartZoomWheel(el, this.options);
        const cb = () => this.scaleUpdated.dispatch();
        this.touch.scaleUpdated.on(cb);
        this.mouse.scaleUpdated.on(cb);
        this.wheel.scaleUpdated.on(cb);
    }
    onScaleUpdated(callback) {
        this.scaleUpdated.on(callback);
    }
    /** Call this when scale updated outside */
    update() {
        this.touch.update();
    }
}
//# sourceMappingURL=index.js.map