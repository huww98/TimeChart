# Time Chart

[![npm version](https://img.shields.io/npm/v/timechart.svg)](https://www.npmjs.com/package/timechart)
[![GitHub Pages](https://github.com/huww98/TimeChart/workflows/GitHub%20Pages/badge.svg)](https://huww98.github.io/TimeChart/)

An chart library specialized for large-scale time-series data, built on WebGL.

Flexable. Realtime monitor. High performance interaction.

[Live Demo](https://huww98.github.io/TimeChart/demo/)

## Performance

Taking advantage of the newest WebGL technology, we can directly talk to GPU, pushing the limit of the performance of rendering chart in browser. This library can display almost unlimited data points, and handle user interactions (pan / zoom) at 60 fps.

We compare the performance of this library and some other popular libraries. See [Performance](https://huww98.github.io/TimeChart/docs/performance)

## Usage

### Installation

* Use npm

  ```shell
  npm install timechart
  ```

* Use HTML script tag

  This library depends on D3 to draw axes and something else. It needs to be included seperatedly.

  ```HTML
  <script src="https://d3js.org/d3-array.v2.min.js"></script>
  <script src="https://d3js.org/d3-color.v2.min.js"></script>
  <script src="https://d3js.org/d3-format.v2.min.js"></script>
  <script src="https://d3js.org/d3-interpolate.v2.min.js"></script>
  <script src="https://d3js.org/d3-time.v2.min.js"></script>
  <script src="https://d3js.org/d3-time-format.v3.min.js"></script>
  <script src="https://d3js.org/d3-scale.v3.min.js"></script>
  <script src="https://d3js.org/d3-selection.v2.min.js"></script>
  <script src="https://d3js.org/d3-axis.v2.min.js"></script>
  <script src="https://huww98.github.io/TimeChart/dist/timechart.min.js"></script>
  ```

### Basic

Display a basic line chart with axes.

```HTML
<div id="chart" style="width: 100%; height: 640px;"></div>
```
```JavaScript
const el = document.getElementById('chart');
const data = [];
for (let x = 0; x < 100; x++) {
    data.push({x, y: Math.random()});
}
const chart = new TimeChart(el, {
    series: [{ data }],
});
```
[Live](https://huww98.github.io/TimeChart/demo/basic.html)

### Data

To add data dynamically, just push new data points to the data array, then call `chart.update()`.

Some restrictions to the provided data:
* You can only add new data. Once you call `update`, you can not edit or delete existing data.
* The x value of each data point must be monotonically increasing.

### Global Options

Specify these options in top level option object. e.g. to specify `lineWidth`:
```JavaScript
const chart = new TimeChart(el, {
    series: [{ data }],
    lineWidth: 10,
});
```

* lineWidth (number): default line width for every data series.

  default: 1

* backgroundColor (CSS color specifier or [d3-color](https://github.com/d3/d3-color) instance)

  default: 'transparent'

* paddingTop / paddingRight / paddingLeft / paddingBottom (number): Padding to add to chart area in CSS pixel. Also reverse space for axes.

  default: 10 / 10 / 45 / 20

* xRange / yRange ({min: number, max: number} or 'auto'): The range of x / y axes. Also use this to control pan / zoom programmatically. Specify `'auto'` to calculate these range from data automatically. Data points outside these range will be drawn in padding area, to display as much data as possible to user.

  default: 'auto'

* realTime (boolean): If true, move xRange to newest data point at every frame.

  default: false

* baseTime (number): Milliseconds since `new Date(0)`. Every x in data are relative to this. Set this option and keep the absolute value of x small for higher floating point precision.

  default: 0

* xScaleType (() => Scale): A factory method that returns an object conforming d3-scale interface. Can be used to customize the appearance of x-axis.
[`scaleTime`](https://github.com/d3/d3-scale#time-scales),
[`scaleUtc`](https://github.com/d3/d3-scale#scaleUtc),
[`scaleLinear`](https://github.com/d3/d3-scale#linear-scales)
from d3-scale are known to work.

  default: d3.scaleTime

* debugWebGL (boolean): If true, detect any error in WebGL calls. Most WebGL calls are asynchronized, and detecting error will force synchronization, which may slows down the program. Mainly used in development of this library.

  default: false

### Series Options

Specify these options in series option object. e.g. to specify `lineWidth`:
```JavaScript
const chart = new TimeChart(el, {
    series: [{
        data,
        lineWidth: 10,
    }],
});
```

* data ({x: number, y: number}[]): Array of data points to be drawn. `x` is the time elapsed in millisecond since `baseTime`

* lineWidth (number or undefined): If undefined, use global option.

  default: undefined

* name (string): The name of the series. Will be shown in legend and tooltips.

  default: ''

* color (CSS color specifier or [d3-color](https://github.com/d3/d3-color) instance): line color

  default: `color` CSS property value at initialization.

* visible (boolean): Whether this series is visible

  default: true

### Zoom Options

These options enable the builtin touch / mouse / trackpad [interaction](#interaction) support. The x, y axis can be enabled separately.

Specify these options in zoom option object. e.g. to specify `autoRange`:
```JavaScript
const chart = new TimeChart(el, {
    series: [{ data }],
    zoom: {
        x: {
            autoRange: true,
        },
        y: {
            autoRange: true,
        }
    }
});
```

* autoRange (boolean): Determine maxDomain, minDomain automatically.

  default: false

* maxDomain / minDomain (number): The limit of xRange / yRange

  default: Infinity / -Infinity

* maxDomainExtent / minDomainExtent (number): The limit of `max - min` in xRange / yRange

  default: Infinity / 0

# Methods

* `chart.update()`: Request update after some options have been changed. You can call this as many times as needed. The actual update will only happen once per frame.

* `chart.dispose()`: Dispose all the resources used by this chart instance.
  Note: We use shadow root to protect the chart from unintended style conflict. However, there is no easy way to remove the shadow root after dispose.

* `chart.onResize()`: Calculate size after layout changes.
  This method is automatically called when window size changed.
  However, if there are some layout changes that TimeChart is unaware of, you need to call this method manually.

## Interaction

With touch screen:
* 1 finger to pan
* 2 or more finger to pan and zoom

With mouse:
* Left button drag to pan
* wheel scroll translate X axis
* Alt + wheel scroll to translate Y axis
* Ctrl + wheel scroll to zoom X axis
* Ctrl + Alt + wheel scroll to zoom Y axis
* Hold Shift key to speed up translate or zoom 5 times

With trackpad:
* Pan X or Y direction to translate X axis
* Alt + Pan X/Y direction to translate X/Y axis
* Pinch to zoom X axis
* Alt + pinch to zoom Y axis
* Hold Shift key to speed up translate or zoom 5 times

## Styling

The chart is in a shadow root so that most CSS in the main document can not affect it. But we do provide some styling interface.

For example, we can support dark theme easily:

```HTML
<div id="chart" class="dark-theme"></div>
```
```CSS
.dark-theme {
    color: white;
    background: black;
    --background-overlay: black;
}
```

[Live](https://huww98.github.io/TimeChart/demo/dark.html)

The `--background-overlay` CSS property is used in some non-transparent element on top on the chart.

The background of the chart is transparent by default.
So it's easy to change the background by setting the background of parent element.

All foreground elements will change color to match the `color` CSS property.
However, chart is drawn in canvas and cannot respond to CSS property changes.
You need to change the color manually if you want to change the `color` after initialiation.

## Development

* run `npm install` to install dependencies
* run `npm start` to automatically build changes
* run `npm run demo` then open http://127.0.0.1:8080/demo/index.html to test changes
* run `npm test` to run automatic tests
