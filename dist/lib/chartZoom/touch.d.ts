import { EventDispatcher } from '../utils';
import { CapableElement, ResolvedOptions } from './options';
export declare class ChartZoomTouch {
    private el;
    private options;
    scaleUpdated: EventDispatcher<() => void>;
    private majorDirection;
    private previousPoints;
    private enabled;
    constructor(el: CapableElement, options: ResolvedOptions);
    update(): void;
    private syncEnabled;
    private syncTouchAction;
    private calcKB;
    private touchPoints;
    private dirOptions;
    private onTouchStart;
    private onTouchEnd;
    private onTouchMove;
}
