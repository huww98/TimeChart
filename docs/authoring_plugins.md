# Authoring Plugins

TimeChart comes with a simple but flexible plugin system to help you customize the chart to whatever you want.

A plugin is a JavaScript object with a function named `apply`.
This function takes a single argument, the current TimeChart instance.

And the return value of this function will be added to `chart.plugins` object. You can use this interact with code outside the plugin.
```JavaScript
import TimeChart from 'timechart';
const demoPlugin = {
    apply(chart) {
        // Do whatever you want
        return 'demo';
    }
};
const chart = new TimeChart(el, {
    plugins: { demoPlugin },
});
chart.plugins.demoPlugin === 'demo'; // true
```

The same plugin instance may be applied to multiple chart instance.

Inside the `apply` function. The plugin can use many advanced APIs documented below.

## Event

TimeChart implemented a simple event mechanism to communicate with plugins. For example, to subscribe to an event:

```JavaScript
chart.model.updated.on(() => console.log('chart updated'));
chart.model.resized.on((w, h) => console.log(`chart resized to ${w}x${h}`));
```

The following document use TypeScript notation to denote the event signature. For example: `Event<(width: number, height: number) => void>` means this is an event, the listener of it will get two arguments, each of type number; and the listener should not return anything.

## APIs

* chart.model.updated (`Event<() => void>`): Triggered when the chart should render a new frame, e.g. new data arrived, viewport changed. This will be triggered at most once per frame

* chart.model.resized (`Event<(width: number, height: number) => void>`): Triggered when the browser window resized, or `chart.onResize()` is invoked. the new dimention of the chart is passed in.

* chart.model.disposing (`Event<() => void>`): Triggered when `chart.dispose()` is invoked. Plugins should remove any event listener added to DOM, remove any element directly attached to `chart.el`;

* chart.model.xScale, chart.model.xScale ([`d3.scaleLinear`](https://github.com/d3/d3-scale#scaleLinear)): used to translate between data points and coordinate used in HTML/SVG.

* chart.model.pxPoint() (`({x: number, y: number}) => {x: number, y: number}`): a helper to get the coordinate used in HTML/SVG from data point.

* chart.model.xRange, chart.model.yRange (`{min: number, max: number}`): The range of data points.

* chart.canvasLayer.gl: The [WebGL rendering context](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext). [WebGL 2](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext) if avaliable.

* chart.svgLayer.svgNode: Top level [SVG node](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/svg).

* chart.contentBoxDetector.node: an empty HTML element that is positioned only on non-padding area. plugins may want to add event listeners to it.

* chart.nearestPoint.points (`Map<SeriesOptions, {x: number, y: number}>`): The points in each series that is nearest to the mouse. In HTML coordinate.

* chart.nearestPoint.updated (`Event<() => void>`): Like `chart.model.updated`, but only triggered when there are updates to `chart.nearestPoint.points`.

## Pass Options to Plugin

Sometimes you may need to pass some extra options or data to plugins. The recommended way to do this is declare your plugin as a class and pass them in from constructor:

```JavaScript
import TimeChart from 'timechart';
class DemoPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(chart) {
        // Do whatever you want with this.options
    }
};
const chart = new TimeChart(el, {
    plugins: { demoPlugin: new DemoPlugin({...}) },
});
```
