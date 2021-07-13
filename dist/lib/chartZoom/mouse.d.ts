import { EventDispatcher } from '../utils';
import { CapableElement, ResolvedOptions } from './options';
export declare class ChartZoomMouse {
    private el;
    private options;
    scaleUpdated: EventDispatcher<() => void>;
    private previousPoint;
    constructor(el: CapableElement, options: ResolvedOptions);
    private point;
    private onMouseMove;
    private onMouseDown;
    private onMouseUp;
}
