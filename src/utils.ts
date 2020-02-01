/** lower bound */
export function domainSearch<T>(data: ArrayLike<T>, start: number, end: number, value: number, key: (v: T) => number) {
    if (start >= end) {
        return start;
    }

    if (value <= key(data[start])) {
        return start;
    }
    if (value > key(data[end - 1])) {
        return end;
    }

    end -= 1;
    while (start + 1 < end) {
        const minDomain = key(data[start]);
        const maxDomain = key(data[end]);
        const ratio = maxDomain <= minDomain ? 0 : (value - minDomain) / (maxDomain - minDomain);
        let expectedIndex = Math.ceil(start + ratio * (end - start));
        if (expectedIndex === end)
            expectedIndex--;
        else if (expectedIndex === start)
            expectedIndex++;
        const domain = key(data[expectedIndex]);

        if (domain < value) {
            start = expectedIndex;
        } else {
            end = expectedIndex;
        }
    }
    return end;
}

export class EventDispatcher<TArgs extends Array<any>>  {
    private callbacks: Array<(...args: TArgs) => void> = []
    on(callback: (...args: TArgs) => void) {
        this.callbacks.push(callback);
    }
    dispatch(...args: TArgs) {
        for (const cb of this.callbacks) {
            cb(...args);
        }
    }
}
