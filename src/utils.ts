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

type CbParameters<T extends (...args: Array<any>) => void> = T extends (...args: infer P) => void ? P : never;

export class EventDispatcher<TCb extends (...args: Array<any>) => void = (() => void)>  {
    private callbacks: Array<TCb> = []
    on(callback: TCb) {
        this.callbacks.push(callback);
    }
    dispatch(...args: CbParameters<TCb>) {
        for (const cb of this.callbacks) {
            cb(...args);
        }
    }
}
