import {expectType, expectError} from 'tsd';
import core from '@/core';
import TimeChart from '@/index';
import { TimeChartPlugin } from '@/plugins';
import { crosshair } from '@/plugins/crosshair';
import { Legend, legend } from '@/plugins/legend';

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
