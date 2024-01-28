import { DataPoint } from "./renderModel";
export declare class DataPointsBuffer<T = DataPoint> extends Array<T> {
    pushed_back: number;
    pushed_front: number;
    poped_back: number;
    poped_front: number;
    constructor(arrayLength: number);
    constructor(...items: T[]);
    _synced(): void;
    static _from_array<T>(arr: Array<T> | DataPointsBuffer<T>): DataPointsBuffer<T>;
    push(...items: T[]): number;
    pop(): T | undefined;
    unshift(...items: T[]): number;
    shift(): T | undefined;
    private updateDelete;
    private updateInsert;
    splice(start: number, deleteCount?: number, ...items: T[]): T[];
}
