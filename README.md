# Time Chart

An chart library specialized for large-scale time-series data, built on WebGL.

Flexable. Realtime monitor. High performance interaction.

[Live Demo](https://huww98.github.io/TimeChart/demo/)

## Performance

Taking advantage of the newest WebGL technology, we can directly talk to GPU, pushing the limit of the performance of rendering chart in browser. This library can display almost unlimited data points, and handle user interactions (pan / zoom) at 60 fps.

We compare the performance of this library and some other popular libraries. See [Performance](https://huww98.github.io/TimeChart/docs/performance)

## Usage

### Installation

* Use npm (not avalable yet)

  ```shell
  npm install timechart
  ```

* Use HTML script tag

  This library depends on D3 to draw axes and something else. It needs to be included seperatedly.

  ```HTML
  <script src="https://d3js.org/d3-array.v2.min.js"></script>
  <script src="https://d3js.org/d3-color.v1.min.js"></script>
  <script src="https://d3js.org/d3-format.v1.min.js"></script>
  <script src="https://d3js.org/d3-interpolate.v1.min.js"></script>
  <script src="https://d3js.org/d3-time.v1.min.js"></script>
  <script src="https://d3js.org/d3-time-format.v2.min.js"></script>
  <script src="https://d3js.org/d3-scale.v3.min.js"></script>
  <script src="https://d3js.org/d3-selection.v1.min.js"></script>
  <script src="https://d3js.org/d3-axis.v1.min.js"></script>
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

  default: d3.rgb(255, 255, 255, 1)

* paddingTop / paddingRight / paddingLeft / paddingBottom (number): Padding to add to chart area in CSS pixel. Also reverse space for axes.

  default: 10 / 10 / 45 / 20

* xRange / yRange ({min: number, max: number} or 'auto'): The range of x / y axes. Also use this to control pan / zoom programmatically. Specify `'auto'` to calculate these range from data automatically. Data points outside these range will be drawn in padding area, to display as much data as possible to user.

  default: 'auto'

* realTime (boolean): If true, move xRange to newest data point at every frame.

  default: false

* baseTime (number): Milliseconds since `new Date(0)`. Every x in data are relative to this. Set this option and keep the absolute value of x small for higher floating point precision.

  default: 0

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

* data ({x: number, y: number}[]): Array of data points to be drawn.

* lineWidth (number or undefined): If undefined, use global option.

  default: undefined

* name (string): Reversed for future use (legend, tooltip)

  default: ''

* color (CSS color specifier or [d3-color](https://github.com/d3/d3-color) instance): line color

  default: d3.rgb(0, 0, 0, 1)

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

## Development

* run `npm install` to install dependencies
* run `npm start` to automatically build changes
* run `npm run demo` then open http://127.0.0.1:8080/demo/index.html to test changes
* run `npm test` to run automatic tests
