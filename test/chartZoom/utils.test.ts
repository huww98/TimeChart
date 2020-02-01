import { zip, linearRegression } from "../../src/chartZoom/utils";

describe('zip test', () => {
    it('basic', () => {
        expect(zip([1, 2, 3], [4, 5, 6])).toEqual([[1, 4], [2, 5], [3, 6]]);
    });
})

describe('linear regression test', () => {
    it('1pt', () => {
        expect(linearRegression([{ x: 1, y: 2 }])).toEqual({ k: 0, b: 2 });
    })
    it('2pt', () => {
        expect(linearRegression([{ x: 1, y: 2 }, { x: 2, y: 3 }])).toEqual({ k: 1, b: 1 });
    });
    it('3pt colinear', () => {
        expect(linearRegression([{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }])).toEqual({ k: 1, b: 1 });
    });
    it('3pt', () => {
        expect(linearRegression([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: -1 }])).toEqual({ k: -0.5, b: 0.5 });
    });
})
