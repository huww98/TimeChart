(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-selection')) :
    typeof define === 'function' && define.amd ? define(['exports', 'd3-selection'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.TimeChart = global.TimeChart || {}, global.TimeChart.plugins_extra = {}), global.d3));
}(this, (function (exports, d3Selection) { 'use strict';

    class EventsPlugin {
        constructor(data) {
            this.data = data ?? [];
        }
        apply(chart) {
            const d3Svg = d3Selection.select(chart.svgLayer.svgNode);
            const box = d3Svg.append('svg');
            box.append('style').text(`
.timechart-event-line {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 2 1;
    opacity: 0.7;
}`);
            chart.model.resized.on((w, h) => {
                box.attr('height', h - chart.options.paddingBottom);
            });
            chart.model.updated.on(() => {
                const eventEl = box.selectAll('g')
                    .data(this.data);
                eventEl.exit().remove();
                const newEventEl = eventEl.enter().append('g');
                newEventEl.append('line')
                    .attr('y2', '100%')
                    .attr('class', 'timechart-event-line');
                newEventEl.append('text')
                    .attr('x', 5)
                    .attr('y', chart.options.paddingTop)
                    .attr('dy', '0.8em');
                const allEventEl = eventEl.merge(newEventEl);
                allEventEl.attr('transform', d => `translate(${chart.model.xScale(d.x)}, 0)`);
                allEventEl.select('text')
                    .text(d => d.name);
            });
            return this;
        }
    }

    exports.EventsPlugin = EventsPlugin;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=timechart.plugins_extra.js.map
