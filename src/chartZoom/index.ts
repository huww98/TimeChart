import { EventDispatcher } from '@/utils';
import { ChartZoomMouse } from './mouse';
import { CapableElement, ChartZoomOptions, ResolvedOptions } from "./options";
import { ChartZoomTouch } from './touch';
import { ChartZoomWheel } from './wheel';

const defaultAxisOptions = {
    minDomain: -Infinity,
    maxDomain: Infinity,
    minDomainExtent: 0,
    maxDomainExtent: Infinity,
} as const;

export class ChartZoom {
    options: ResolvedOptions;
    private touch: ChartZoomTouch;
    private mouse: ChartZoomMouse;
    private wheel: ChartZoomWheel;
    private scaleUpdated = new EventDispatcher();

    constructor(el: CapableElement, options?: ChartZoomOptions) {
        options = options ?? {};
        this.options = {
            x: options.x && { ...defaultAxisOptions, ...options.x },
            y: options.y && { ...defaultAxisOptions, ...options.y },
        };

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
