import { DataPointsBuffer } from '../src/core/dataPointsBuffer';

function syncedBuffer(...items: number[]) {
    const b = new DataPointsBuffer<number>(...items);
    b._synced();
    return b;
}

describe('DataPointsBuffer', () => {
    test('push back', () => {
        const b = syncedBuffer();
        b.push(1, 2);
        expect(b.pushed_back).toBe(2);
    });
    describe('pop back', () => {
        test('synced', () => {
            const b = syncedBuffer(0, 1, 2);
            expect(b.pop()).toBe(2);
            expect(b.poped_back).toBe(1);
        });
        test('just pushed', () => {
            const b = syncedBuffer();
            b.push(2, 3);
            expect(b.pushed_back).toBe(2);
            expect(b.pop()).toBe(3);
            expect(b.poped_back).toBe(0);
            expect(b.pushed_back).toBe(1);
        });
        test('empty', () => {
            const b = syncedBuffer();
            expect(b.pop()).toBe(undefined);
            expect(b.poped_back).toBe(0);
        });
        test('through', () => {
            const b = syncedBuffer(0, 1);
            b.unshift(-6, -5, -4)
            expect(b.pushed_front).toBe(3);
            b.pop()
            b.pop()
            b.pop()
            expect(b.poped_back).toBe(2);
            expect(b.pushed_front).toBe(2);
        });
    });
    test('push front', () => {
        const b = syncedBuffer();
        b.unshift(1, 2);
        expect(b.pushed_front).toBe(2);
    });
    describe('pop front', () => {
        test('synced', () => {
            const b = syncedBuffer(0, 1, 2);
            expect(b.shift()).toBe(0);
            expect(b.poped_front).toBe(1);
        });
        test('just pushed', () => {
            const b = syncedBuffer();
            b.unshift(2, 3);
            expect(b.pushed_front).toBe(2);
            expect(b.shift()).toBe(2);
            expect(b.poped_front).toBe(0);
            expect(b.pushed_front).toBe(1);
        });
        test('empty', () => {
            const b = syncedBuffer();
            expect(b.shift()).toBe(undefined);
            expect(b.poped_front).toBe(0);
        });
        test('through', () => {
            const b = syncedBuffer(0, 1);
            b.push(4, 5, 6)
            expect(b.pushed_back).toBe(3);
            b.shift()
            b.shift()
            b.shift()
            expect(b.poped_front).toBe(2);
            expect(b.pushed_back).toBe(2);
        });
    });
    describe('splice', () => {
        test('delete all', () => {
            const b = syncedBuffer(4, 5, 6);
            b.shift();
            b.unshift(1);
            b.pop();
            b.push(8);
            b.splice(0);
            expect(b.pushed_front).toBe(0);
            expect(b.pushed_back).toBe(0);
            expect(b.poped_front + b.poped_back).toBe(3);
        });
        test('pop front', () => {
            const b = syncedBuffer(4, 5, 6);
            b.splice(0, 2);
            expect(b.poped_front).toBe(2);
        });
        test('pop back', () => {
            const b = syncedBuffer(4, 5, 6);
            b.splice(1, 2);
            expect(b.poped_back).toBe(2);
        });
        test('pop middle', () => {
            const b = syncedBuffer(4, 5, 6);
            expect(() => { b.splice(1, 1) }).toThrow(RangeError);
        });
        test('pop pushed front', () => {
            const b = syncedBuffer(4, 5, 6);
            b.unshift(0, 1, 2)
            b.splice(1, 1);
            expect(b.poped_front).toBe(0);
            expect(b.pushed_front).toBe(2);
        });
        test('pop pushed back', () => {
            const b = syncedBuffer(4, 5, 6);
            b.push(0, 1, 2)
            b.splice(4, 1);
            expect(b.poped_back).toBe(0);
            expect(b.pushed_back).toBe(2);
        });
        test('insert front', () => {
            const b = syncedBuffer(4, 5, 6);
            b.splice(0, 0, 1, 2);
            expect(b.pushed_front).toBe(2);
        });
        test('insert back', () => {
            const b = syncedBuffer(4, 5, 6);
            b.splice(3, 0, 8, 9);
            expect(b.pushed_back).toBe(2);
        });
        test('insert middle', () => {
            const b = syncedBuffer(4, 5, 6);
            expect(() => { b.splice(1, 0, 8, 9) }).toThrow(RangeError);
        });
    });
});
