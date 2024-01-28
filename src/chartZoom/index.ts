import { EventDispatcher } from '../utils';
import { ChartZoomMouse } from './mouse';
import { CapableElement, ChartZoomOptions, ResolvedOptions } from "./options";
import { ChartZoomTouch } from './touch';
import { ChartZoomWheel } from './wheel';

export const defaultAxisOptions = {
    minDomain: -Infinity,
    maxDomain: Infinity,
    minDomainExtent: 0,
    maxDomainExtent: Infinity,
} as const;

export const defaultOptions = {
    panMouseButtons: 1 | 2 | 4,
    touchMinPoints: 1,
} as const;

export class ChartZoom {
    options: ResolvedOptions;
    private touch: ChartZoomTouch;
    private mouse: ChartZoomMouse;
    private wheel: ChartZoomWheel;
    private scaleUpdated = new EventDispatcher();

    constructor(el: CapableElement, options?: ChartZoomOptions) {
        options = options ?? {};
        this.options = new Proxy(options, {
            get(target, prop) {
                if (prop === 'x' || prop === 'y') {
                    const op = target[prop];
                    if (!op)
                        return op;
                    return new Proxy(op, {
                        get(target, prop) {
                            return (target as any)[prop] ?? (defaultAxisOptions as any)[prop];
                        }
                    })
                }
                if (prop === 'eventElement') {
                    return target[prop] ?? el;
                }
                return (target as any)[prop] ?? (defaultOptions as any)[prop];
            }
        }) as ResolvedOptions;

        this.touch = new ChartZoomTouch(el, this.options);
        this.mouse = new ChartZoomMouse(el, this.options);
        this.wheel = new ChartZoomWheel(el, this.options);

        const cb = () => this.scaleUpdated.dispatch();
        this.touch.scaleUpdated.on(cb);
        this.mouse.scaleUpdated.on(cb);
        this.wheel.scaleUpdated.on(cb);
    }

    onScaleUpdated(callback: () => void) {
        this.scaleUpdated.on(callback);
    }

    /** Call this when scale updated outside */
    update() {
        this.touch.update();
    }
}
