import {expectType, expectError} from 'tsd';
import core from '../src/core';
import TimeChart from '../src/index';
import { TimeChartPlugin } from '../src/plugins';
import { crosshair } from '../src/plugins/crosshair';
import { Legend, legend } from '../src/plugins/legend';

const el = {} as HTMLElement;
const chart = new core(el, {
    baseTime: 1,
    plugins: {
        legend,
        crosshair,
    },
})

expectType<void>(chart.plugins.crosshair);
expectType<Legend>(chart.plugins.legend)
expectError(chart.plugins.a)

const chart2 = new core(el, {
    baseTime: 1,
    // @ts-expect-error
    plugins: [],
})

const chart3 = new TimeChart(el, {
    plugins: {
        test: {} as TimeChartPlugin<number>
    }
})
expectType<number>(chart3.plugins.test)
expectType<Legend>(chart3.plugins.legend)
