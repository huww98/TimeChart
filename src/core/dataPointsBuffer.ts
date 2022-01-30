import { DataPoint } from "./renderModel";

export class DataPointsBuffer<T = DataPoint> extends Array<T> {
    pushed_back = 0;
    pushed_front = 0;
    poped_back = 0;
    poped_front = 0;

    constructor(arrayLength: number);
    constructor(...items: T[]);
    constructor() {
        super(...arguments);
        this.pushed_back = this.length;
    }

    _synced() {
        this.pushed_back = this.poped_back = this.pushed_front = this.poped_front = 0;
    }

    static _from_array<T>(arr: Array<T> | DataPointsBuffer<T>): DataPointsBuffer<T> {
        if (arr instanceof DataPointsBuffer)
            return arr;
        const b = Object.setPrototypeOf(arr, DataPointsBuffer.prototype) as DataPointsBuffer<T>
        b.poped_back = b.pushed_front = b.poped_front = 0;
        b.pushed_back = b.length;
        return b;
    }

    override push(...items: T[]): number {
        this.pushed_back += items.length;
        return super.push(...items);
    }

    override pop(): T | undefined {
        const len = this.length;
        const r = super.pop();
        if (r === undefined)
            return r;

        if (this.pushed_back > 0)
            this.pushed_back--;
        else if (len - this.pushed_front > 0)
            this.poped_back++;
        else
            this.pushed_front--;
        return r;
    }

    override unshift(...items: T[]): number {
        this.pushed_front += items.length;
        return super.unshift(...items);
    }

    override shift(): T | undefined {
        const len = this.length;
        const r = super.shift();
        if (r === undefined)
            return r;

        if (this.pushed_front > 0)
            this.pushed_front--;
        else if (len - this.pushed_back > 0)
            this.poped_front++;
        else
            this.pushed_back--;
        return r;
    }

    private updateDelete(start: number, deleteCount: number, len: number) {
        if (deleteCount === 0)
            return;

        const d = (c: number) => {
            deleteCount -= c;
            len -= c;
            return deleteCount === 0;
        }

        if (start < this.pushed_front) {
            const c = Math.min(deleteCount, this.pushed_front - start);
            this.pushed_front -= c;
            if (d(c))
                return;
        }

        if (start === this.pushed_front) {
            const c = Math.min(deleteCount, len - this.pushed_front - this.pushed_back);
            this.poped_front += c
            if (d(c))
                return;
        }

        if (start > this.pushed_front && start < len - this.pushed_back) {
            if (start + deleteCount < len - this.pushed_back)
                throw new RangeError("DataPoints that already synced to GPU cannot be delete in the middle");
            const c = Math.min(deleteCount, len - start - this.pushed_back);
            this.poped_back += c;
            if (d(c))
                return;
        }

        const c = Math.min(deleteCount, len - start);
        this.pushed_back -= c;
        if (d(c))
            return;

        throw new Error('BUG');
    }

    private updateInsert(start: number, insertCount: number, len: number) {
        if (start <= this.pushed_front) {
            this.pushed_front += insertCount;
        } else if (start >= len - this.pushed_back) {
            this.pushed_back += insertCount;
        } else {
            throw new RangeError("DataPoints cannot be inserted in the middle of the range that is already synced to GPU");
        }
    }

    override splice(start: number, deleteCount?: number, ...items: T[]): T[] {
        if (start === -Infinity)
            start = 0
        else if (start < 0)
            start = Math.max(this.length + start, 0);

        if (deleteCount === undefined)
            deleteCount = this.length - start;
        else
            deleteCount = Math.min(Math.max(deleteCount, 0), this.length - start);

        this.updateDelete(start, deleteCount, this.length);
        this.updateInsert(start, items.length, this.length - deleteCount);

        const expectedLen = this.length - deleteCount + items.length;
        const r = super.splice(start, deleteCount, ...items);
        if (this.length !== expectedLen)
            throw new Error(`BUG! length after splice not expected. ${this.length} vs ${expectedLen}`);
        return r;
    }
}
