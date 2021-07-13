import { ScaleLinear } from 'd3-scale';
import { ResolvedAxisOptions } from './options';
export declare function zip<T1, T2>(...rows: [T1[], T2[]]): [T1, T2][];
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
export declare function linearRegression(data: {
    x: number;
    y: number;
}[]): {
    k: number;
    b: number;
};
export declare function scaleK(scale: ScaleLinear<number, number>): number;
/**
 * @returns If domain changed
 */
export declare function applyNewDomain(op: ResolvedAxisOptions, domain: number[]): boolean;
export declare function variance(data: number[]): number;
export declare function clamp(value: number, min: number, max: number): number;
