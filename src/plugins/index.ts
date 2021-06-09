import core from '../core';
import { TimeChartPlugins } from '../options';

export interface TimeChartPlugin<TState=any> {
    apply(chart: core<TimeChartPlugins>): TState;
}
