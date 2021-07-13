/** lower bound */
export function domainSearch(data, start, end, value, key) {
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
        }
        else {
            end = expectedIndex;
        }
    }
    return end;
}
export class EventDispatcher {
    constructor() {
        this.callbacks = [];
    }
    on(callback) {
        this.callbacks.push(callback);
    }
    dispatch(...args) {
        for (const cb of this.callbacks) {
            cb(...args);
        }
    }
}
//# sourceMappingURL=utils.js.map