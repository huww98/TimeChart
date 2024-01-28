/** lower bound */
export declare function domainSearch<T>(data: ArrayLike<T>, start: number, end: number, value: number, key: (v: T) => number): number;
type CbParameters<T extends (...args: Array<any>) => void> = T extends (...args: infer P) => void ? P : never;
export declare class EventDispatcher<TCb extends (...args: Array<any>) => void = (() => void)> {
    private callbacks;
    on(callback: TCb): void;
    dispatch(...args: CbParameters<TCb>): void;
}
export {};
