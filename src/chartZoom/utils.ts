import { ScaleLinear } from 'd3-scale';
import { ResolvedAxisOptions } from './options';

export function zip<T1, T2>(...rows: [T1[], T2[]]) {
    return [...rows[0]].map((_, c) => rows.map(row => row[c])) as [T1, T2][];
}

/**
 * least squares
 *
 * beta^T = [b, k]
 * X = [[1, x_1],
 *      [1, x_2],
 *      [1, x_3], ...]
 * Y^T = [y_1, y_2, y_3, ...]
 * beta = (X^T X)^(-1) X^T Y
 * @returns `{k, b}`
 */
export function linearRegression(data: { x: number, y: number }[]) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const len = data.length;

    for (const p of data) {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
    }
    const det = (len * sumXX) - (sumX * sumX);
    const k = det === 0 ? 0 : ((len * sumXY) - (sumX * sumY)) / det;
    const b = (sumY - k * sumX) / len;
    return { k, b };
}

export function scaleK(scale: ScaleLinear<number, number>) {
    const domain = scale.domain();
    const range = scale.range();
    return (domain[1] - domain[0]) / (range[1] - range[0]);
}

/**
 * @returns If domain changed
 */
export function applyNewDomain(op: ResolvedAxisOptions, domain: number[]) {
    const inExtent = domain[1] - domain[0];

    const previousDomain = op.scale.domain();
    if ((previousDomain[1] - previousDomain[0]) * inExtent <= 0) {
        // forbidden reverse direction.
        return false;
    }

    const extent = Math.min(op.maxDomainExtent, Math.max(op.minDomainExtent, inExtent));
    const deltaE = (extent - inExtent) / 2;
    domain[0] -= deltaE;
    domain[1] += deltaE;

    const deltaO = Math.min(Math.max(op.minDomain - domain[0], 0), op.maxDomain - domain[1]);
    domain[0] += deltaO;
    domain[1] += deltaO;

    const eps = extent * 1e-6;
    op.scale.domain(domain);
    if (zip(domain, previousDomain).some(([d, pd]) => Math.abs(d - pd) > eps)) {
        return true;
    }
    return false;
}

export function variance(data: number[]) {
    const mean = data.reduce((a, b) => a + b)/ data.length;
    return data.map(d => (d - mean) ** 2).reduce((a, b) => a + b) / data.length;
}

export function clamp(value: number, min: number, max: number) {
    if (value > max) {
        return max;
    } else if (value < min) {
        return min;
    }
    return value;
}
