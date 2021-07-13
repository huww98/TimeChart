import { EventDispatcher } from '../utils';
import { CapableElement, ResolvedOptions } from "./options";
export declare class ChartZoomWheel {
    private el;
    private options;
    scaleUpdated: EventDispatcher<() => void>;
    constructor(el: CapableElement, options: ResolvedOptions);
    private onWheel;
}
