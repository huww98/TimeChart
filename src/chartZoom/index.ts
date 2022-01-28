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

type WithDefaults<T, TDefault> = {x?: T&TDefault, y?: T&TDefault}

export function resolveOptions<T, TDefault extends Object>(defaults: TDefault, o?: {x?: T, y?: T}): WithDefaults<T, TDefault> {
    if (!o)
        o = {}
    const resolveAxis = (ao?: T) => {
        if (ao && !defaults.isPrototypeOf(ao))
            Object.setPrototypeOf(ao, defaults);
    }
    resolveAxis(o.x);
    resolveAxis(o.y);
    return o as WithDefaults<T, TDefault>;
}

export class ChartZoom {
    options: ResolvedOptions;
    private touch: ChartZoomTouch;
    private mouse: ChartZoomMouse;
    private wheel: ChartZoomWheel;
    private scaleUpdated = new EventDispatcher();

    constructor(el: CapableElement, options?: ChartZoomOptions) {
        options = options ?? {};
        this.options = resolveOptions(defaultAxisOptions, options);

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
