# Time Chart

An chart library specialized for large-scale time-series data, built on WebGL.

Flexable. Realtime monitor. High performance interaction.

[Live Demo](https://huww98.github.io/TimeChart/demo/)

## Performance

Taking advantage of the newest WebGL technology, we can directly talk to GPU, pushing the limit of the performance of rendering chart in browser. This library can display almost unlimited data points, and handle user interactions (pan / zoom) at 60 fps.

We compare the performance of this library and some other popular libraries.

TODO

## Usage

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

TODO

### Series Options

TODO

### Zoom Options

These options enable the builtin touch / mouse / trackpad [interaction](#Interaction) support.

TODO

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
