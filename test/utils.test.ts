import { domainSearch } from "../src/utils";

describe('DomainSearch test', () => {
    const key = (x: number) => x
    it('exact match', () => {
        const data = [0, 1, 2, 3, 4, 5];
        expect(domainSearch(data, 0, data.length, 2, key)).toEqual(2);
    });
    it('insert point', () => {
        const data = [0, 1, 2, 3, 4, 5];
        expect(domainSearch(data, 0, data.length, 2.4, key)).toEqual(3);
        expect(domainSearch(data, 0, data.length, 2.5, key)).toEqual(3);
        expect(domainSearch(data, 0, data.length, 2.6, key)).toEqual(3);
    });
    it('out lower bound', () => {
        const data = [0, 1, 2, 3, 4, 5];
        expect(domainSearch(data, 0, data.length, -1, key)).toEqual(0);
    });
    it('out upper bound', () => {
        const data = [0, 1, 2, 3, 4, 5];
        expect(domainSearch(data, 0, data.length, 10, key)).toEqual(data.length);
    });
    it('duplicated', () => {
        const data = [0, 1, 2, 2, 4, 5];
        expect(domainSearch(data, 0, data.length, 3, key)).toEqual(4);
    });
    it('duplicated lower bound', () => {
        const data = [0, 1, 2, 2, 4, 5];
        for (let end = 2; end <= 6; end++) {
            expect(domainSearch(data, 0, end, 2, key)).toEqual(2);
        }
    });
    it('uneven', () => {
        const data = [0];
        for (let i = 0; i < 100; i++) {
            data.push(100);
        }
        expect(domainSearch(data, 0, data.length, 99, key)).toEqual(1);
    });
    it('empty', () => {
        expect(domainSearch([], 0, 0, 0, key)).toEqual(0);
    })
})
