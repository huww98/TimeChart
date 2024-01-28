(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('d3-color'), require('d3-scale'), require('d3-axis'), require('d3-selection')) :
    typeof define === 'function' && define.amd ? define(['d3-color', 'd3-scale', 'd3-axis', 'd3-selection'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.TimeChart = factory(global.d3, global.d3, global.d3, global.d3));
})(this, (function (d3Color, d3Scale, d3Axis$1, d3Selection) { 'use strict';

    var LineType;
    (function (LineType) {
        LineType[LineType["Line"] = 0] = "Line";
        LineType[LineType["Step"] = 1] = "Step";
        LineType[LineType["NativeLine"] = 2] = "NativeLine";
        LineType[LineType["NativePoint"] = 3] = "NativePoint";
    })(LineType || (LineType = {}));
    function resolveColorRGBA(color) {
        const rgbColor = typeof color === 'string' ? d3Color.rgb(color) : d3Color.rgb(color);
        return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
    }

    function getContext(canvas) {
        const ctx = canvas.getContext('webgl2');
        if (!ctx) {
            throw new Error('Unable to initialize WebGL2. Your browser or machine may not support it.');
        }
        return ctx;
    }
    class CanvasLayer {
        constructor(el, options, model) {
            this.options = options;
            const canvas = document.createElement('canvas');
            const style = canvas.style;
            style.position = 'absolute';
            style.width = style.height = '100%';
            style.left = style.right = style.top = style.bottom = '0';
            el.shadowRoot.appendChild(canvas);
            this.gl = getContext(canvas);
            const bgColor = resolveColorRGBA(options.backgroundColor);
            this.gl.clearColor(...bgColor);
            this.canvas = canvas;
            model.updated.on(() => {
                this.clear();
                this.syncViewport();
            });
            model.resized.on((w, h) => this.onResize(w, h));
            model.disposing.on(() => {
                el.shadowRoot.removeChild(canvas);
                canvas.width = 0;
                canvas.height = 0;
                const lossContext = this.gl.getExtension('WEBGL_lose_context');
                if (lossContext) {
                    lossContext.loseContext();
                }
            });
        }
        syncViewport() {
            const o = this.options;
            const r = o.pixelRatio;
            this.gl.viewport(o.renderPaddingLeft * r, o.renderPaddingBottom * r, (this.canvas.width - (o.renderPaddingLeft + o.renderPaddingRight) * r), (this.canvas.height - (o.renderPaddingTop + o.renderPaddingBottom) * r));
        }
        onResize(width, height) {
            const canvas = this.canvas;
            const scale = this.options.pixelRatio;
            canvas.width = width * scale;
            canvas.height = height * scale;
            this.syncViewport();
        }
        clear() {
            const gl = this.gl;
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    }

    class ContentBoxDetector {
        constructor(el, model, options) {
            this.node = document.createElement('div');
            this.node.style.position = 'absolute';
            this.node.style.left = `${options.paddingLeft}px`;
            this.node.style.right = `${options.paddingRight}px`;
            this.node.style.top = `${options.paddingTop}px`;
            this.node.style.bottom = `${options.paddingBottom}px`;
            el.shadowRoot.appendChild(this.node);
            model.disposing.on(() => {
                el.shadowRoot.removeChild(this.node);
            });
        }
    }

    /** lower bound */
    function domainSearch(data, start, end, value, key) {
        if (start >= end) {
            return start;
        }
        if (value <= key(data[start])) {
            return start;
        }
        if (value > key(data[end - 1])) {
            return end;
        }
        end -= 1;
        while (start + 1 < end) {
            const minDomain = key(data[start]);
            const maxDomain = key(data[end]);
            const ratio = maxDomain <= minDomain ? 0 : (value - minDomain) / (maxDomain - minDomain);
            let expectedIndex = Math.ceil(start + ratio * (end - start));
            if (expectedIndex === end)
                expectedIndex--;
            else if (expectedIndex === start)
                expectedIndex++;
            const domain = key(data[expectedIndex]);
            if (domain < value) {
                start = expectedIndex;
            }
            else {
                end = expectedIndex;
            }
        }
        return end;
    }
    class EventDispatcher {
        constructor() {
            this.callbacks = [];
        }
        on(callback) {
            this.callbacks.push(callback);
        }
        dispatch(...args) {
            for (const cb of this.callbacks) {
                cb(...args);
            }
        }
    }

    class NearestPointModel {
        constructor(canvas, model, options, detector) {
            this.canvas = canvas;
            this.model = model;
            this.options = options;
            this.dataPoints = new Map();
            this.lastPointerPos = null;
            this.updated = new EventDispatcher();
            detector.node.addEventListener('mousemove', ev => {
                const rect = canvas.canvas.getBoundingClientRect();
                this.lastPointerPos = {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                };
                this.adjustPoints();
            });
            detector.node.addEventListener('mouseleave', ev => {
                this.lastPointerPos = null;
                this.adjustPoints();
            });
            model.updated.on(() => this.adjustPoints());
        }
        adjustPoints() {
            if (this.lastPointerPos === null) {
                this.dataPoints.clear();
            }
            else {
                const domain = this.model.xScale.invert(this.lastPointerPos.x);
                for (const s of this.options.series) {
                    if (s.data.length == 0 || !s.visible) {
                        this.dataPoints.delete(s);
                        continue;
                    }
                    const pos = domainSearch(s.data, 0, s.data.length, domain, d => d.x);
                    const near = [];
                    if (pos > 0) {
                        near.push(s.data[pos - 1]);
                    }
                    if (pos < s.data.length) {
                        near.push(s.data[pos]);
                    }
                    const sortKey = (a) => Math.abs(a.x - domain);
                    near.sort((a, b) => sortKey(a) - sortKey(b));
                    const pxPoint = this.model.pxPoint(near[0]);
                    const width = this.canvas.canvas.clientWidth;
                    const height = this.canvas.canvas.clientHeight;
                    if (pxPoint.x <= width && pxPoint.x >= 0 &&
                        pxPoint.y <= height && pxPoint.y >= 0) {
                        this.dataPoints.set(s, near[0]);
                    }
                    else {
                        this.dataPoints.delete(s);
                    }
                }
            }
            this.updated.dispatch();
        }
    }

    function calcMinMaxY(arr, start, end) {
        let max = -Infinity;
        let min = Infinity;
        for (let i = start; i < end; i++) {
            const v = arr[i].y;
            if (v > max)
                max = v;
            if (v < min)
                min = v;
        }
        return { max, min };
    }
    function unionMinMax(...items) {
        return {
            min: Math.min(...items.map(i => i.min)),
            max: Math.max(...items.map(i => i.max)),
        };
    }
    class RenderModel {
        constructor(options) {
            this.options = options;
            this.xScale = d3Scale.scaleLinear();
            this.yScale = d3Scale.scaleLinear();
            this.xRange = null;
            this.yRange = null;
            this.resized = new EventDispatcher();
            this.updated = new EventDispatcher();
            this.disposing = new EventDispatcher();
            this.abortController = new AbortController();
            this.redrawRequested = false;
            if (options.xRange !== 'auto' && options.xRange) {
                this.xScale.domain([options.xRange.min, options.xRange.max]);
            }
            if (options.yRange !== 'auto' && options.yRange) {
                this.yScale.domain([options.yRange.min, options.yRange.max]);
            }
        }
        resize(width, height) {
            const op = this.options;
            this.xScale.range([op.paddingLeft, width - op.paddingRight]);
            this.yScale.range([height - op.paddingBottom, op.paddingTop]);
            this.resized.dispatch(width, height);
            this.requestRedraw();
        }
        dispose() {
            if (!this.abortController.signal.aborted) {
                this.abortController.abort();
                this.disposing.dispatch();
            }
        }
        update() {
            this.updateModel();
            this.updated.dispatch();
            for (const s of this.options.series) {
                s.data._synced();
            }
        }
        updateModel() {
            const series = this.options.series.filter(s => s.data.length > 0);
            if (series.length === 0) {
                return;
            }
            const o = this.options;
            {
                const maxDomain = Math.max(...series.map(s => s.data[s.data.length - 1].x));
                const minDomain = Math.min(...series.map(s => s.data[0].x));
                this.xRange = { max: maxDomain, min: minDomain };
                if (this.options.realTime || o.xRange === 'auto') {
                    if (this.options.realTime) {
                        const currentDomain = this.xScale.domain();
                        const range = currentDomain[1] - currentDomain[0];
                        this.xScale.domain([maxDomain - range, maxDomain]);
                    }
                    else { // Auto
                        this.xScale.domain([minDomain, maxDomain]);
                    }
                }
                else if (o.xRange) {
                    this.xScale.domain([o.xRange.min, o.xRange.max]);
                }
            }
            {
                const minMaxY = series.flatMap(s => {
                    return [
                        calcMinMaxY(s.data, 0, s.data.pushed_front),
                        calcMinMaxY(s.data, s.data.length - s.data.pushed_back, s.data.length),
                    ];
                });
                if (this.yRange) {
                    minMaxY.push(this.yRange);
                }
                this.yRange = unionMinMax(...minMaxY);
                if (o.yRange === 'auto') {
                    this.yScale.domain([this.yRange.min, this.yRange.max]).nice();
                }
                else if (o.yRange) {
                    this.yScale.domain([o.yRange.min, o.yRange.max]);
                }
            }
        }
        requestRedraw() {
            if (this.redrawRequested) {
                return;
            }
            this.redrawRequested = true;
            const signal = this.abortController.signal;
            requestAnimationFrame((time) => {
                this.redrawRequested = false;
                if (!signal.aborted) {
                    this.update();
                }
            });
        }
        pxPoint(dataPoint) {
            return {
                x: this.xScale(dataPoint.x),
                y: this.yScale(dataPoint.y),
            };
        }
    }

    class SVGLayer {
        constructor(el, model) {
            this.svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const style = this.svgNode.style;
            style.position = 'absolute';
            style.width = style.height = '100%';
            style.left = style.right = style.top = style.bottom = '0';
            el.shadowRoot.appendChild(this.svgNode);
            model.disposing.on(() => {
                el.shadowRoot.removeChild(this.svgNode);
            });
        }
    }
    function makeContentBox(model, options) {
        const contentSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        contentSvg.classList.add('content-box');
        contentSvg.x.baseVal.value = options.paddingLeft;
        contentSvg.y.baseVal.value = options.paddingRight;
        model.resized.on((width, height) => {
            contentSvg.width.baseVal.value = width - options.paddingRight - options.paddingLeft;
            contentSvg.height.baseVal.value = height - options.paddingTop - options.paddingBottom;
        });
        return contentSvg;
    }

    class DataPointsBuffer extends Array {
        constructor() {
            super(...arguments);
            this.pushed_back = 0;
            this.pushed_front = 0;
            this.poped_back = 0;
            this.poped_front = 0;
            this.pushed_back = this.length;
        }
        _synced() {
            this.pushed_back = this.poped_back = this.pushed_front = this.poped_front = 0;
        }
        static _from_array(arr) {
            if (arr instanceof DataPointsBuffer)
                return arr;
            const b = Object.setPrototypeOf(arr, DataPointsBuffer.prototype);
            b.poped_back = b.pushed_front = b.poped_front = 0;
            b.pushed_back = b.length;
            return b;
        }
        push(...items) {
            this.pushed_back += items.length;
            return super.push(...items);
        }
        pop() {
            const len = this.length;
            const r = super.pop();
            if (r === undefined)
                return r;
            if (this.pushed_back > 0)
                this.pushed_back--;
            else if (len - this.pushed_front > 0)
                this.poped_back++;
            else
                this.pushed_front--;
            return r;
        }
        unshift(...items) {
            this.pushed_front += items.length;
            return super.unshift(...items);
        }
        shift() {
            const len = this.length;
            const r = super.shift();
            if (r === undefined)
                return r;
            if (this.pushed_front > 0)
                this.pushed_front--;
            else if (len - this.pushed_back > 0)
                this.poped_front++;
            else
                this.pushed_back--;
            return r;
        }
        updateDelete(start, deleteCount, len) {
            if (deleteCount === 0)
                return;
            const d = (c) => {
                deleteCount -= c;
                len -= c;
                return deleteCount === 0;
            };
            if (start < this.pushed_front) {
                const c = Math.min(deleteCount, this.pushed_front - start);
                this.pushed_front -= c;
                if (d(c))
                    return;
            }
            if (start === this.pushed_front) {
                const c = Math.min(deleteCount, len - this.pushed_front - this.pushed_back);
                this.poped_front += c;
                if (d(c))
                    return;
            }
            if (start > this.pushed_front && start < len - this.pushed_back) {
                if (start + deleteCount < len - this.pushed_back)
                    throw new RangeError("DataPoints that already synced to GPU cannot be delete in the middle");
                const c = Math.min(deleteCount, len - start - this.pushed_back);
                this.poped_back += c;
                if (d(c))
                    return;
            }
            const c = Math.min(deleteCount, len - start);
            this.pushed_back -= c;
            if (d(c))
                return;
            throw new Error('BUG');
        }
        updateInsert(start, insertCount, len) {
            if (start <= this.pushed_front) {
                this.pushed_front += insertCount;
            }
            else if (start >= len - this.pushed_back) {
                this.pushed_back += insertCount;
            }
            else {
                throw new RangeError("DataPoints cannot be inserted in the middle of the range that is already synced to GPU");
            }
        }
        splice(start, deleteCount, ...items) {
            if (start === -Infinity)
                start = 0;
            else if (start < 0)
                start = Math.max(this.length + start, 0);
            if (deleteCount === undefined)
                deleteCount = this.length - start;
            else
                deleteCount = Math.min(Math.max(deleteCount, 0), this.length - start);
            this.updateDelete(start, deleteCount, this.length);
            this.updateInsert(start, items.length, this.length - deleteCount);
            const expectedLen = this.length - deleteCount + items.length;
            const r = super.splice(start, deleteCount, ...items);
            if (this.length !== expectedLen)
                throw new Error(`BUG! length after splice not expected. ${this.length} vs ${expectedLen}`);
            return r;
        }
    }

    const defaultOptions$2 = {
        pixelRatio: window.devicePixelRatio,
        lineWidth: 1,
        backgroundColor: d3Color.rgb(0, 0, 0, 0),
        paddingTop: 10,
        paddingRight: 10,
        paddingLeft: 45,
        paddingBottom: 20,
        renderPaddingTop: 0,
        renderPaddingRight: 0,
        renderPaddingLeft: 0,
        renderPaddingBottom: 0,
        xRange: 'auto',
        yRange: 'auto',
        realTime: false,
        baseTime: 0,
        xScaleType: d3Scale.scaleTime,
        debugWebGL: false,
        forceWebGL1: false,
        legend: true,
    };
    const defaultSeriesOptions = {
        name: '',
        color: null,
        visible: true,
        lineType: LineType.Line,
        stepLocation: 1.,
    };
    function completeSeriesOptions(s) {
        s.data = s.data ? DataPointsBuffer._from_array(s.data) : new DataPointsBuffer();
        Object.setPrototypeOf(s, defaultSeriesOptions);
        return s;
    }
    function completeOptions(el, options) {
        const dynamicDefaults = {
            series: [],
            color: getComputedStyle(el).getPropertyValue('color'),
        };
        const o = Object.assign({}, dynamicDefaults, options);
        o.series = o.series.map(s => completeSeriesOptions(s));
        Object.setPrototypeOf(o, defaultOptions$2);
        return o;
    }
    let TimeChart$1 = class TimeChart {
        get options() { return this._options; }
        constructor(el, options) {
            var _a, _b;
            this.el = el;
            this.disposed = false;
            const coreOptions = completeOptions(el, options);
            this.model = new RenderModel(coreOptions);
            const shadowRoot = (_a = el.shadowRoot) !== null && _a !== void 0 ? _a : el.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.innerText = `
:host {
    contain: size layout paint style;
    position: relative;
}`;
            shadowRoot.appendChild(style);
            this.canvasLayer = new CanvasLayer(el, coreOptions, this.model);
            this.svgLayer = new SVGLayer(el, this.model);
            this.contentBoxDetector = new ContentBoxDetector(el, this.model, coreOptions);
            this.nearestPoint = new NearestPointModel(this.canvasLayer, this.model, coreOptions, this.contentBoxDetector);
            this._options = coreOptions;
            this.plugins = Object.fromEntries(Object.entries((_b = options === null || options === void 0 ? void 0 : options.plugins) !== null && _b !== void 0 ? _b : {}).map(([name, p]) => [name, p.apply(this)]));
            this.onResize();
            const resizeHandler = () => this.onResize();
            window.addEventListener('resize', resizeHandler);
            this.model.disposing.on(() => {
                window.removeEventListener('resize', resizeHandler);
                shadowRoot.removeChild(style);
            });
        }
        onResize() {
            this.model.resize(this.el.clientWidth, this.el.clientHeight);
        }
        update() {
            if (this.disposed) {
                throw new Error('Cannot update after dispose.');
            }
            // fix dynamic added series
            for (let i = 0; i < this.options.series.length; i++) {
                const s = this.options.series[i];
                if (!defaultSeriesOptions.isPrototypeOf(s)) {
                    this.options.series[i] = completeSeriesOptions(s);
                }
            }
            this.model.requestRedraw();
        }
        dispose() {
            this.model.dispose();
            this.disposed = true;
        }
    };

    var DIRECTION;
    (function (DIRECTION) {
        DIRECTION[DIRECTION["UNKNOWN"] = 0] = "UNKNOWN";
        DIRECTION[DIRECTION["X"] = 1] = "X";
        DIRECTION[DIRECTION["Y"] = 2] = "Y";
    })(DIRECTION || (DIRECTION = {}));
    function dirOptions(options) {
        return [
            { dir: DIRECTION.X, op: options.x },
            { dir: DIRECTION.Y, op: options.y },
        ].filter(i => i.op !== undefined);
    }

    function zip(...rows) {
        return [...rows[0]].map((_, c) => rows.map(row => row[c]));
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
    function linearRegression(data) {
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
    function scaleK(scale) {
        const domain = scale.domain();
        const range = scale.range();
        return (domain[1] - domain[0]) / (range[1] - range[0]);
    }
    /**
     * @returns If domain changed
     */
    function applyNewDomain(op, domain) {
        const inExtent = domain[1] - domain[0];
        const previousDomain = op.scale.domain();
        if ((previousDomain[1] - previousDomain[0]) * inExtent <= 0) {
            // forbidden reverse direction.
            return false;
        }
        const extent = Math.min(op.maxDomainExtent, op.maxDomain - op.minDomain, Math.max(op.minDomainExtent, inExtent));
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
    function variance(data) {
        const mean = data.reduce((a, b) => a + b) / data.length;
        return data.map(d => (d - mean) ** 2).reduce((a, b) => a + b) / data.length;
    }
    function clamp(value, min, max) {
        if (value > max) {
            return max;
        }
        else if (value < min) {
            return min;
        }
        return value;
    }

    class ChartZoomMouse {
        constructor(el, options) {
            this.el = el;
            this.options = options;
            this.scaleUpdated = new EventDispatcher();
            this.previousPoint = null;
            const eventEl = options.eventElement;
            eventEl.style.userSelect = 'none';
            eventEl.addEventListener('pointerdown', ev => this.onMouseDown(ev));
            eventEl.addEventListener('pointerup', ev => this.onMouseUp(ev));
            eventEl.addEventListener('pointermove', ev => this.onMouseMove(ev));
        }
        point(ev) {
            const boundingRect = this.el.getBoundingClientRect();
            return {
                [DIRECTION.X]: ev.clientX - boundingRect.left,
                [DIRECTION.Y]: ev.clientY - boundingRect.top,
            };
        }
        onMouseMove(event) {
            if (this.previousPoint === null) {
                return;
            }
            const p = this.point(event);
            let changed = false;
            for (const { dir, op } of dirOptions(this.options)) {
                const offset = p[dir] - this.previousPoint[dir];
                const k = scaleK(op.scale);
                const domain = op.scale.domain();
                const newDomain = domain.map(d => d - k * offset);
                if (applyNewDomain(op, newDomain)) {
                    changed = true;
                }
            }
            this.previousPoint = p;
            if (changed) {
                this.scaleUpdated.dispatch();
            }
        }
        onMouseDown(event) {
            if (event.pointerType !== 'mouse')
                return;
            if ((event.buttons & this.options.panMouseButtons) === 0)
                return;
            const eventEl = this.options.eventElement;
            eventEl.setPointerCapture(event.pointerId);
            this.previousPoint = this.point(event);
            eventEl.style.cursor = 'grabbing';
        }
        onMouseUp(event) {
            if (this.previousPoint === null) {
                return;
            }
            const eventEl = this.options.eventElement;
            this.previousPoint = null;
            eventEl.releasePointerCapture(event.pointerId);
            eventEl.style.cursor = '';
        }
    }

    class ChartZoomTouch {
        constructor(el, options) {
            this.el = el;
            this.options = options;
            this.scaleUpdated = new EventDispatcher();
            this.majorDirection = DIRECTION.UNKNOWN;
            this.previousPoints = new Map();
            this.enabled = {
                [DIRECTION.X]: false,
                [DIRECTION.Y]: false,
            };
            const eventEl = options.eventElement;
            eventEl.addEventListener('touchstart', e => this.onTouchStart(e), { passive: true });
            eventEl.addEventListener('touchend', e => this.onTouchEnd(e), { passive: true });
            eventEl.addEventListener('touchcancel', e => this.onTouchEnd(e), { passive: true });
            eventEl.addEventListener('touchmove', e => this.onTouchMove(e), { passive: true });
            this.update();
        }
        update() {
            this.syncEnabled();
            this.syncTouchAction();
        }
        syncEnabled() {
            for (const { dir, op } of dirOptions(this.options)) {
                if (!op) {
                    this.enabled[dir] = false;
                }
                else {
                    const domain = op.scale.domain().sort();
                    this.enabled[dir] = op.minDomain < domain[0] && domain[1] < op.maxDomain;
                }
            }
        }
        syncTouchAction() {
            const actions = [];
            if (!this.enabled[DIRECTION.X]) {
                actions.push('pan-x');
            }
            if (!this.enabled[DIRECTION.Y]) {
                actions.push('pan-y');
            }
            if (actions.length === 0) {
                actions.push('none');
            }
            this.el.style.touchAction = actions.join(' ');
        }
        calcKB(dir, op, data) {
            if (dir === this.majorDirection && data.length >= 2) {
                const domain = op.scale.domain();
                const extent = domain[1] - domain[0];
                if (variance(data.map(d => d.domain)) > 1e-4 * extent * extent) {
                    return linearRegression(data.map(t => ({ x: t.current, y: t.domain })));
                }
            }
            // Pan only
            const k = scaleK(op.scale);
            const b = data.map(t => t.domain - k * t.current).reduce((a, b) => a + b) / data.length;
            return { k, b };
        }
        touchPoints(touches) {
            if (touches.length < this.options.touchMinPoints) {
                this.previousPoints.clear();
                return;
            }
            const boundingBox = this.el.getBoundingClientRect();
            const ts = new Map([...touches].map(t => [t.identifier, {
                    [DIRECTION.X]: t.clientX - boundingBox.left,
                    [DIRECTION.Y]: t.clientY - boundingBox.top,
                }]));
            let changed = false;
            for (const { dir, op } of dirOptions(this.options)) {
                const scale = op.scale;
                const temp = [...ts.entries()].map(([id, p]) => ({ current: p[dir], previousPoint: this.previousPoints.get(id) }))
                    .filter(t => t.previousPoint !== undefined)
                    .map(({ current, previousPoint }) => ({ current, domain: scale.invert(previousPoint[dir]) }));
                if (temp.length === 0) {
                    continue;
                }
                const { k, b } = this.calcKB(dir, op, temp);
                const domain = scale.range().map(r => b + k * r);
                if (applyNewDomain(op, domain)) {
                    changed = true;
                }
            }
            this.previousPoints = ts;
            if (changed) {
                this.scaleUpdated.dispatch();
            }
            return changed;
        }
        dirOptions(dir) {
            return {
                [DIRECTION.X]: this.options.x,
                [DIRECTION.Y]: this.options.y,
            }[dir];
        }
        onTouchStart(event) {
            if (this.majorDirection === DIRECTION.UNKNOWN && event.touches.length >= 2) {
                const ts = [...event.touches];
                function vari(data) {
                    const mean = data.reduce((a, b) => a + b) / data.length;
                    return data.map(d => (d - mean) ** 2).reduce((a, b) => a + b);
                }
                const varX = vari(ts.map(t => t.clientX));
                const varY = vari(ts.map(t => t.clientY));
                this.majorDirection = varX > varY ? DIRECTION.X : DIRECTION.Y;
                if (this.dirOptions(this.majorDirection) === undefined) {
                    this.majorDirection = DIRECTION.UNKNOWN;
                }
            }
            this.touchPoints(event.touches);
        }
        onTouchEnd(event) {
            if (event.touches.length === 0) {
                this.majorDirection = DIRECTION.UNKNOWN;
            }
            this.touchPoints(event.touches);
        }
        onTouchMove(event) {
            this.touchPoints(event.touches);
        }
    }

    class ChartZoomWheel {
        constructor(el, options) {
            this.el = el;
            this.options = options;
            this.scaleUpdated = new EventDispatcher();
            const eventEl = options.eventElement;
            eventEl.addEventListener('wheel', ev => this.onWheel(ev));
        }
        onWheel(event) {
            event.preventDefault();
            let deltaX = event.deltaX;
            let deltaY = event.deltaY;
            switch (event.deltaMode) {
                case 1: // line
                    deltaX *= 30;
                    deltaY *= 30;
                    break;
                case 2: // page
                    deltaX *= 400;
                    deltaY *= 400;
                    break;
            }
            const transform = {
                [DIRECTION.X]: {
                    translate: 0,
                    zoom: 0,
                },
                [DIRECTION.Y]: {
                    translate: 0,
                    zoom: 0,
                }
            };
            if (event.ctrlKey || event.metaKey) { // zoom
                if (event.altKey) {
                    transform[DIRECTION.X].zoom = deltaX;
                    transform[DIRECTION.Y].zoom = deltaY;
                }
                else {
                    transform[DIRECTION.X].zoom = (deltaX + deltaY);
                }
            }
            else { // translate
                if (event.altKey) {
                    transform[DIRECTION.X].translate = deltaX;
                    transform[DIRECTION.Y].translate = deltaY;
                }
                else {
                    transform[DIRECTION.X].translate = (deltaX + deltaY);
                }
            }
            const boundingRect = this.el.getBoundingClientRect();
            const origin = {
                [DIRECTION.X]: event.clientX - boundingRect.left,
                [DIRECTION.Y]: event.clientY - boundingRect.top,
            };
            let changed = false;
            for (const { dir, op } of dirOptions(this.options)) {
                const domain = op.scale.domain();
                const k = scaleK(op.scale);
                const trans = transform[dir];
                const transOrigin = op.scale.invert(origin[dir]);
                trans.translate *= k;
                trans.zoom *= 0.002;
                if (event.shiftKey) {
                    trans.translate *= 5;
                    trans.zoom *= 5;
                }
                const extent = domain[1] - domain[0];
                const translateCap = 0.4 * extent;
                trans.translate = clamp(trans.translate, -translateCap, translateCap);
                const zoomCap = 0.5;
                trans.zoom = clamp(trans.zoom, -zoomCap, zoomCap);
                const newDomain = domain.map(d => d + trans.translate + (d - transOrigin) * trans.zoom);
                if (applyNewDomain(op, newDomain)) {
                    changed = true;
                }
            }
            if (changed) {
                this.scaleUpdated.dispatch();
            }
        }
    }

    const defaultAxisOptions = {
        minDomain: -Infinity,
        maxDomain: Infinity,
        minDomainExtent: 0,
        maxDomainExtent: Infinity,
    };
    const defaultOptions$1 = {
        panMouseButtons: 1 | 2 | 4,
        touchMinPoints: 1,
    };
    class ChartZoom {
        constructor(el, options) {
            this.scaleUpdated = new EventDispatcher();
            options = options !== null && options !== void 0 ? options : {};
            this.options = new Proxy(options, {
                get(target, prop) {
                    var _a, _b;
                    if (prop === 'x' || prop === 'y') {
                        const op = target[prop];
                        if (!op)
                            return op;
                        return new Proxy(op, {
                            get(target, prop) {
                                var _a;
                                return (_a = target[prop]) !== null && _a !== void 0 ? _a : defaultAxisOptions[prop];
                            }
                        });
                    }
                    if (prop === 'eventElement') {
                        return (_a = target[prop]) !== null && _a !== void 0 ? _a : el;
                    }
                    return (_b = target[prop]) !== null && _b !== void 0 ? _b : defaultOptions$1[prop];
                }
            });
            this.touch = new ChartZoomTouch(el, this.options);
            this.mouse = new ChartZoomMouse(el, this.options);
            this.wheel = new ChartZoomWheel(el, this.options);
            const cb = () => this.scaleUpdated.dispatch();
            this.touch.scaleUpdated.on(cb);
            this.mouse.scaleUpdated.on(cb);
            this.wheel.scaleUpdated.on(cb);
        }
        onScaleUpdated(callback) {
            this.scaleUpdated.on(callback);
        }
        /** Call this when scale updated outside */
        update() {
            this.touch.update();
        }
    }

    class TimeChartZoom {
        constructor(chart, options) {
            this.options = options;
            this.registerZoom(chart);
        }
        applyAutoRange(o, dataRange) {
            if (!o)
                return;
            if (!o.autoRange) {
                delete o.minDomain;
                delete o.maxDomain;
                return;
            }
            let [min, max] = o.scale.domain();
            if (dataRange) {
                min = Math.min(min, dataRange.min);
                max = Math.max(max, dataRange.max);
            }
            o.minDomain = min;
            o.maxDomain = max;
        }
        registerZoom(chart) {
            const o = this.options;
            const z = new ChartZoom(chart.el, o);
            chart.model.updated.on(() => {
                this.applyAutoRange(o.x, chart.model.xRange);
                this.applyAutoRange(o.y, chart.model.yRange);
                z.update();
            });
            z.onScaleUpdated(() => {
                chart.options.xRange = null;
                chart.options.yRange = null;
                chart.options.realTime = false;
                chart.update();
            });
        }
    }
    const defaults = {
        autoRange: true,
    };
    class TimeChartZoomPlugin {
        constructor(options) {
            this.options = options;
        }
        resolveOptions(chart) {
            var _a;
            const o = (_a = this.options) !== null && _a !== void 0 ? _a : {};
            return new Proxy(o, {
                get: (target, prop) => {
                    switch (prop) {
                        case 'x':
                        case 'y':
                            const op = target[prop];
                            if (!op)
                                return op;
                            return new Proxy(op, {
                                get: (target, prop2) => {
                                    var _a;
                                    if (prop2 === 'scale') {
                                        switch (prop) {
                                            case 'x':
                                                return chart.model.xScale;
                                            case 'y':
                                                return chart.model.yScale;
                                        }
                                    }
                                    return (_a = target[prop2]) !== null && _a !== void 0 ? _a : defaults[prop2];
                                }
                            });
                        case 'eventElement':
                            return chart.contentBoxDetector.node;
                        default:
                            return target[prop];
                    }
                }
            });
        }
        apply(chart) {
            return new TimeChartZoom(chart, this.resolveOptions(chart));
        }
    }

    const crosshair = {
        apply(chart) {
            const contentBox = makeContentBox(chart.model, chart.options);
            const initTrans = contentBox.createSVGTransform();
            initTrans.setTranslate(0, 0);
            const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
            style.textContent = `
.timechart-crosshair {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 2 1;
    visibility: hidden;
}`;
            const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.transform.baseVal.initialize(initTrans);
            hLine.x2.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);
            const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            vLine.transform.baseVal.initialize(initTrans);
            vLine.y2.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.classList.add('timechart-crosshair');
            for (const e of [style, hLine, vLine]) {
                g.appendChild(e);
            }
            const detector = chart.contentBoxDetector;
            detector.node.addEventListener('mousemove', ev => {
                const contentRect = contentBox.getBoundingClientRect();
                hLine.transform.baseVal.getItem(0).setTranslate(0, ev.clientY - contentRect.y);
                vLine.transform.baseVal.getItem(0).setTranslate(ev.clientX - contentRect.x, 0);
            });
            detector.node.addEventListener('mouseenter', ev => g.style.visibility = 'visible');
            detector.node.addEventListener('mouseleave', ev => g.style.visibility = 'hidden');
            contentBox.appendChild(g);
            chart.svgLayer.svgNode.appendChild(contentBox);
        }
    };

    const d3Axis = {
        apply(chart) {
            const d3Svg = d3Selection.select(chart.svgLayer.svgNode);
            const xg = d3Svg.append('g');
            const yg = d3Svg.append('g');
            const xAxis = d3Axis$1.axisBottom(chart.model.xScale);
            const yAxis = d3Axis$1.axisLeft(chart.model.yScale);
            function update() {
                const xs = chart.model.xScale;
                const xts = chart.options.xScaleType()
                    .domain(xs.domain().map(d => d + chart.options.baseTime))
                    .range(xs.range());
                xAxis.scale(xts);
                xg.call(xAxis);
                yAxis.scale(chart.model.yScale);
                yg.call(yAxis);
            }
            chart.model.updated.on(update);
            chart.model.resized.on((w, h) => {
                const op = chart.options;
                xg.attr('transform', `translate(0, ${h - op.paddingBottom})`);
                yg.attr('transform', `translate(${op.paddingLeft}, 0)`);
                update();
            });
        }
    };

    class Legend {
        constructor(el, model, options) {
            this.el = el;
            this.model = model;
            this.options = options;
            this.items = new Map();
            this.legend = document.createElement('chart-legend');
            const ls = this.legend.style;
            ls.position = 'absolute';
            ls.right = `${options.paddingRight}px`;
            ls.top = `${options.paddingTop}px`;
            const legendRoot = this.legend.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = `
:host {
    background: var(--background-overlay, white);
    border: 1px solid hsl(0, 0%, 80%);
    border-radius: 3px;
    padding: 5px 10px;
}
.item {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    user-select: none;
}
.item:not(.visible) {
    color: gray;
    text-decoration: line-through;
}
.item .example {
    width: 50px;
    margin-right: 10px;
    max-height: 1em;
}`;
            legendRoot.appendChild(style);
            this.itemContainer = legendRoot;
            this.update();
            const shadowRoot = el.shadowRoot;
            shadowRoot.appendChild(this.legend);
            model.updated.on(() => this.update());
            model.disposing.on(() => {
                shadowRoot.removeChild(this.legend);
            });
        }
        update() {
            var _a, _b;
            this.legend.style.display = this.options.legend ? "" : "none";
            if (!this.options.legend)
                return;
            for (const s of this.options.series) {
                if (!this.items.has(s)) {
                    const item = document.createElement('div');
                    item.className = 'item';
                    const example = document.createElement('div');
                    example.className = 'example';
                    item.appendChild(example);
                    const name = document.createElement('label');
                    name.textContent = s.name;
                    item.appendChild(name);
                    this.itemContainer.appendChild(item);
                    item.addEventListener('click', (ev) => {
                        s.visible = !s.visible;
                        this.model.update();
                    });
                    this.items.set(s, { item, example });
                }
                const item = this.items.get(s);
                item.item.classList.toggle('visible', s.visible);
                item.example.style.height = `${(_a = s.lineWidth) !== null && _a !== void 0 ? _a : this.options.lineWidth}px`;
                item.example.style.backgroundColor = ((_b = s.color) !== null && _b !== void 0 ? _b : this.options.color).toString();
            }
        }
    }
    const legend = {
        apply(chart) {
            return new Legend(chart.el, chart.model, chart.options);
        }
    };

    /**
     * Common utilities
     * @module glMatrix
     */
    // Configuration Constants
    var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
    if (!Math.hypot) Math.hypot = function () {
      var y = 0,
          i = arguments.length;

      while (i--) {
        y += arguments[i] * arguments[i];
      }

      return Math.sqrt(y);
    };

    /**
     * 2 Dimensional Vector
     * @module vec2
     */

    /**
     * Creates a new, empty vec2
     *
     * @returns {vec2} a new 2D vector
     */

    function create() {
      var out = new ARRAY_TYPE(2);

      if (ARRAY_TYPE != Float32Array) {
        out[0] = 0;
        out[1] = 0;
      }

      return out;
    }
    /**
     * Creates a new vec2 initialized with the given values
     *
     * @param {Number} x X component
     * @param {Number} y Y component
     * @returns {vec2} a new 2D vector
     */

    function fromValues(x, y) {
      var out = new ARRAY_TYPE(2);
      out[0] = x;
      out[1] = y;
      return out;
    }
    /**
     * Divides two vec2's
     *
     * @param {vec2} out the receiving vector
     * @param {ReadonlyVec2} a the first operand
     * @param {ReadonlyVec2} b the second operand
     * @returns {vec2} out
     */

    function divide(out, a, b) {
      out[0] = a[0] / b[0];
      out[1] = a[1] / b[1];
      return out;
    }
    /**
     * Perform some operation over an array of vec2s.
     *
     * @param {Array} a the array of vectors to iterate over
     * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
     * @param {Number} offset Number of elements to skip at the beginning of the array
     * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
     * @param {Function} fn Function to call for each vector in the array
     * @param {Object} [arg] additional argument to pass to fn
     * @returns {Array} a
     * @function
     */

    (function () {
      var vec = create();
      return function (a, stride, offset, count, fn, arg) {
        var i, l;

        if (!stride) {
          stride = 2;
        }

        if (!offset) {
          offset = 0;
        }

        if (count) {
          l = Math.min(count * stride + offset, a.length);
        } else {
          l = a.length;
        }

        for (i = offset; i < l; i += stride) {
          vec[0] = a[i];
          vec[1] = a[i + 1];
          fn(vec, vec, arg);
          a[i] = vec[0];
          a[i + 1] = vec[1];
        }

        return a;
      };
    })();

    class LinkedWebGLProgram {
        constructor(gl, vertexSource, fragmentSource, debug) {
            this.gl = gl;
            this.debug = debug;
            const program = throwIfFalsy(gl.createProgram());
            gl.attachShader(program, throwIfFalsy(createShader(gl, gl.VERTEX_SHADER, vertexSource, debug)));
            gl.attachShader(program, throwIfFalsy(createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, debug)));
            this.program = program;
        }
        link() {
            var _a;
            const gl = this.gl;
            const program = this.program;
            gl.linkProgram(program);
            if (this.debug) {
                const success = gl.getProgramParameter(program, gl.LINK_STATUS);
                if (!success) {
                    const message = (_a = gl.getProgramInfoLog(program)) !== null && _a !== void 0 ? _a : 'Unknown Error.';
                    gl.deleteProgram(program);
                    throw new Error(message);
                }
            }
        }
        getUniformLocation(name) {
            return throwIfFalsy(this.gl.getUniformLocation(this.program, name));
        }
        use() {
            this.gl.useProgram(this.program);
        }
    }
    function createShader(gl, type, source, debug) {
        var _a;
        const shader = throwIfFalsy(gl.createShader(type));
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (debug) {
            const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
            if (!success) {
                const message = (_a = gl.getShaderInfoLog(shader)) !== null && _a !== void 0 ? _a : 'Unknown Error.';
                gl.deleteShader(shader);
                throw new Error(message);
            }
        }
        return shader;
    }
    function throwIfFalsy(value) {
        if (!value) {
            throw new Error('value must not be falsy');
        }
        return value;
    }

    const BUFFER_TEXTURE_WIDTH = 256;
    const BUFFER_TEXTURE_HEIGHT = 2048;
    const BUFFER_POINT_CAPACITY = BUFFER_TEXTURE_WIDTH * BUFFER_TEXTURE_HEIGHT;
    const BUFFER_INTERVAL_CAPACITY = BUFFER_POINT_CAPACITY - 2;
    class ShaderUniformData {
        constructor(gl, size) {
            this.gl = gl;
            this.data = new ArrayBuffer(size);
            this.ubo = throwIfFalsy(gl.createBuffer());
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
            gl.bufferData(gl.UNIFORM_BUFFER, this.data, gl.DYNAMIC_DRAW);
        }
        get modelScale() {
            return new Float32Array(this.data, 0, 2);
        }
        get modelTranslate() {
            return new Float32Array(this.data, 2 * 4, 2);
        }
        get projectionScale() {
            return new Float32Array(this.data, 4 * 4, 2);
        }
        upload(index = 0) {
            this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, index, this.ubo);
            this.gl.bufferSubData(this.gl.UNIFORM_BUFFER, 0, this.data);
        }
    }
    const VS_HEADER = `#version 300 es
layout (std140) uniform proj {
    vec2 modelScale;
    vec2 modelTranslate;
    vec2 projectionScale;
};
uniform highp sampler2D uDataPoints;
uniform int uLineType;
uniform float uStepLocation;

const int TEX_WIDTH = ${BUFFER_TEXTURE_WIDTH};
const int TEX_HEIGHT = ${BUFFER_TEXTURE_HEIGHT};

vec2 dataPoint(int index) {
    int x = index % TEX_WIDTH;
    int y = index / TEX_WIDTH;
    return texelFetch(uDataPoints, ivec2(x, y), 0).xy;
}
`;
    const LINE_FS_SOURCE = `#version 300 es
precision lowp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
    outColor = uColor;
}`;
    class NativeLineProgram extends LinkedWebGLProgram {
        constructor(gl, debug) {
            super(gl, NativeLineProgram.VS_SOURCE, LINE_FS_SOURCE, debug);
            this.link();
            this.locations = {
                uDataPoints: this.getUniformLocation('uDataPoints'),
                uPointSize: this.getUniformLocation('uPointSize'),
                uColor: this.getUniformLocation('uColor'),
            };
            this.use();
            gl.uniform1i(this.locations.uDataPoints, 0);
            const projIdx = gl.getUniformBlockIndex(this.program, 'proj');
            gl.uniformBlockBinding(this.program, projIdx, 0);
        }
    }
    NativeLineProgram.VS_SOURCE = `${VS_HEADER}
uniform float uPointSize;

void main() {
    vec2 pos2d = projectionScale * modelScale * (dataPoint(gl_VertexID) + modelTranslate);
    gl_Position = vec4(pos2d, 0, 1);
    gl_PointSize = uPointSize;
}
`;
    class LineProgram extends LinkedWebGLProgram {
        constructor(gl, debug) {
            super(gl, LineProgram.VS_SOURCE, LINE_FS_SOURCE, debug);
            this.link();
            this.locations = {
                uDataPoints: this.getUniformLocation('uDataPoints'),
                uLineType: this.getUniformLocation('uLineType'),
                uStepLocation: this.getUniformLocation('uStepLocation'),
                uLineWidth: this.getUniformLocation('uLineWidth'),
                uColor: this.getUniformLocation('uColor'),
            };
            this.use();
            gl.uniform1i(this.locations.uDataPoints, 0);
            const projIdx = gl.getUniformBlockIndex(this.program, 'proj');
            gl.uniformBlockBinding(this.program, projIdx, 0);
        }
    }
    LineProgram.VS_SOURCE = `${VS_HEADER}
uniform float uLineWidth;

void main() {
    int side = gl_VertexID & 1;
    int di = (gl_VertexID >> 1) & 1;
    int index = gl_VertexID >> 2;

    vec2 dp[2] = vec2[2](dataPoint(index), dataPoint(index + 1));

    vec2 base;
    vec2 off;
    if (uLineType == ${LineType.Line}) {
        base = dp[di];
        vec2 dir = dp[1] - dp[0];
        dir = normalize(modelScale * dir);
        off = vec2(-dir.y, dir.x) * uLineWidth;
    } else if (uLineType == ${LineType.Step}) {
        base = vec2(dp[0].x * (1. - uStepLocation) + dp[1].x * uStepLocation, dp[di].y);
        float up = sign(dp[0].y - dp[1].y);
        off = vec2(uLineWidth * up, uLineWidth);
    }

    if (side == 1)
        off = -off;
    vec2 cssPose = modelScale * (base + modelTranslate);
    vec2 pos2d = projectionScale * (cssPose + off);
    gl_Position = vec4(pos2d, 0, 1);
}`;
    class SeriesSegmentVertexArray {
        constructor(gl, dataPoints) {
            this.gl = gl;
            this.dataPoints = dataPoints;
            this.dataBuffer = throwIfFalsy(gl.createTexture());
            gl.bindTexture(gl.TEXTURE_2D, this.dataBuffer);
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32F, BUFFER_TEXTURE_WIDTH, BUFFER_TEXTURE_HEIGHT);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BUFFER_TEXTURE_WIDTH, BUFFER_TEXTURE_HEIGHT, gl.RG, gl.FLOAT, new Float32Array(BUFFER_TEXTURE_WIDTH * BUFFER_TEXTURE_HEIGHT * 2));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }
        delete() {
            this.gl.deleteTexture(this.dataBuffer);
        }
        syncPoints(start, n, bufferPos) {
            const dps = this.dataPoints;
            let rowStart = Math.floor(bufferPos / BUFFER_TEXTURE_WIDTH);
            let rowEnd = Math.ceil((bufferPos + n) / BUFFER_TEXTURE_WIDTH);
            // Ensure we have some padding at both ends of data.
            if (rowStart > 0 && start === 0 && bufferPos === rowStart * BUFFER_TEXTURE_WIDTH)
                rowStart--;
            if (rowEnd < BUFFER_TEXTURE_HEIGHT && start + n === dps.length && bufferPos + n === rowEnd * BUFFER_TEXTURE_WIDTH)
                rowEnd++;
            const buffer = new Float32Array((rowEnd - rowStart) * BUFFER_TEXTURE_WIDTH * 2);
            for (let r = rowStart; r < rowEnd; r++) {
                for (let c = 0; c < BUFFER_TEXTURE_WIDTH; c++) {
                    const p = r * BUFFER_TEXTURE_WIDTH + c;
                    const i = Math.max(Math.min(start + p - bufferPos, dps.length - 1), 0);
                    const dp = dps[i];
                    const bufferIdx = ((r - rowStart) * BUFFER_TEXTURE_WIDTH + c) * 2;
                    buffer[bufferIdx] = dp.x;
                    buffer[bufferIdx + 1] = dp.y;
                }
            }
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, this.dataBuffer);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, rowStart, BUFFER_TEXTURE_WIDTH, rowEnd - rowStart, gl.RG, gl.FLOAT, buffer);
        }
        /**
         * @param renderInterval [start, end) interval of data points, start from 0
         */
        draw(renderInterval, type) {
            const first = Math.max(0, renderInterval.start);
            const last = Math.min(BUFFER_INTERVAL_CAPACITY, renderInterval.end);
            const count = last - first;
            const gl = this.gl;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.dataBuffer);
            if (type === LineType.Line) {
                gl.drawArrays(gl.TRIANGLE_STRIP, first * 4, count * 4 + (last !== renderInterval.end ? 2 : 0));
            }
            else if (type === LineType.Step) {
                let firstP = first * 4;
                let countP = count * 4 + 2;
                if (first === renderInterval.start) {
                    firstP -= 2;
                    countP += 2;
                }
                gl.drawArrays(gl.TRIANGLE_STRIP, firstP, countP);
            }
            else if (type === LineType.NativeLine) {
                gl.drawArrays(gl.LINE_STRIP, first, count + 1);
            }
            else if (type === LineType.NativePoint) {
                gl.drawArrays(gl.POINTS, first, count + 1);
            }
        }
    }
    /**
     * An array of `SeriesSegmentVertexArray` to represent a series
     */
    class SeriesVertexArray {
        constructor(gl, series) {
            this.gl = gl;
            this.series = series;
            this.segments = [];
            // each segment has at least 2 points
            this.validStart = 0; // start position of the first segment. (0, BUFFER_INTERVAL_CAPACITY]
            this.validEnd = 0; // end position of the last segment. [2, BUFFER_POINT_CAPACITY)
        }
        popFront() {
            if (this.series.data.poped_front === 0)
                return;
            this.validStart += this.series.data.poped_front;
            while (this.validStart > BUFFER_INTERVAL_CAPACITY) {
                const activeArray = this.segments[0];
                activeArray.delete();
                this.segments.shift();
                this.validStart -= BUFFER_INTERVAL_CAPACITY;
            }
            this.segments[0].syncPoints(0, 0, this.validStart);
        }
        popBack() {
            if (this.series.data.poped_back === 0)
                return;
            this.validEnd -= this.series.data.poped_back;
            while (this.validEnd < BUFFER_POINT_CAPACITY - BUFFER_INTERVAL_CAPACITY) {
                const activeArray = this.segments[this.segments.length - 1];
                activeArray.delete();
                this.segments.pop();
                this.validEnd += BUFFER_INTERVAL_CAPACITY;
            }
            this.segments[this.segments.length - 1].syncPoints(this.series.data.length, 0, this.validEnd);
        }
        newArray() {
            return new SeriesSegmentVertexArray(this.gl, this.series.data);
        }
        pushFront() {
            let numDPtoAdd = this.series.data.pushed_front;
            if (numDPtoAdd === 0)
                return;
            const newArray = () => {
                this.segments.unshift(this.newArray());
                this.validStart = BUFFER_POINT_CAPACITY;
            };
            if (this.segments.length === 0) {
                newArray();
                this.validEnd = this.validStart = BUFFER_POINT_CAPACITY - 1;
            }
            while (true) {
                const activeArray = this.segments[0];
                const n = Math.min(this.validStart, numDPtoAdd);
                activeArray.syncPoints(numDPtoAdd - n, n, this.validStart - n);
                numDPtoAdd -= this.validStart - (BUFFER_POINT_CAPACITY - BUFFER_INTERVAL_CAPACITY);
                this.validStart -= n;
                if (this.validStart > 0)
                    break;
                newArray();
            }
        }
        pushBack() {
            let numDPtoAdd = this.series.data.pushed_back;
            if (numDPtoAdd === 0)
                return;
            const newArray = () => {
                this.segments.push(this.newArray());
                this.validEnd = 0;
            };
            if (this.segments.length === 0) {
                newArray();
                this.validEnd = this.validStart = 1;
            }
            while (true) {
                const activeArray = this.segments[this.segments.length - 1];
                const n = Math.min(BUFFER_POINT_CAPACITY - this.validEnd, numDPtoAdd);
                activeArray.syncPoints(this.series.data.length - numDPtoAdd, n, this.validEnd);
                // Note that each segment overlaps with the previous one.
                // numDPtoAdd can increase here, indicating the overlapping part should be synced again to the next segment
                numDPtoAdd -= BUFFER_INTERVAL_CAPACITY - this.validEnd;
                this.validEnd += n;
                // Fully fill the previous segment before creating a new one
                if (this.validEnd < BUFFER_POINT_CAPACITY)
                    break;
                newArray();
            }
        }
        deinit() {
            for (const s of this.segments)
                s.delete();
            this.segments = [];
        }
        syncBuffer() {
            const d = this.series.data;
            if (d.length - d.pushed_back - d.pushed_front < 2) {
                this.deinit();
                d.poped_front = d.poped_back = 0;
            }
            if (this.segments.length === 0) {
                if (d.length >= 2) {
                    if (d.pushed_back > d.pushed_front) {
                        d.pushed_back = d.length;
                        this.pushBack();
                    }
                    else {
                        d.pushed_front = d.length;
                        this.pushFront();
                    }
                }
                return;
            }
            this.popFront();
            this.popBack();
            this.pushFront();
            this.pushBack();
        }
        draw(renderDomain) {
            const data = this.series.data;
            if (this.segments.length === 0 || data[0].x > renderDomain.max || data[data.length - 1].x < renderDomain.min)
                return;
            const key = (d) => d.x;
            const firstDP = domainSearch(data, 1, data.length, renderDomain.min, key) - 1;
            const lastDP = domainSearch(data, firstDP, data.length - 1, renderDomain.max, key);
            const startInterval = firstDP + this.validStart;
            const endInterval = lastDP + this.validStart;
            const startArray = Math.floor(startInterval / BUFFER_INTERVAL_CAPACITY);
            const endArray = Math.ceil(endInterval / BUFFER_INTERVAL_CAPACITY);
            for (let i = startArray; i < endArray; i++) {
                const arrOffset = i * BUFFER_INTERVAL_CAPACITY;
                this.segments[i].draw({
                    start: startInterval - arrOffset,
                    end: endInterval - arrOffset,
                }, this.series.lineType);
            }
        }
    }
    class LineChartRenderer {
        constructor(model, gl, options) {
            this.model = model;
            this.gl = gl;
            this.options = options;
            this.lineProgram = new LineProgram(this.gl, this.options.debugWebGL);
            this.nativeLineProgram = new NativeLineProgram(this.gl, this.options.debugWebGL);
            this.arrays = new Map();
            this.height = 0;
            this.width = 0;
            this.renderHeight = 0;
            this.renderWidth = 0;
            const uboSize = gl.getActiveUniformBlockParameter(this.lineProgram.program, 0, gl.UNIFORM_BLOCK_DATA_SIZE);
            this.uniformBuffer = new ShaderUniformData(this.gl, uboSize);
            model.updated.on(() => this.drawFrame());
            model.resized.on((w, h) => this.onResize(w, h));
        }
        syncBuffer() {
            for (const s of this.options.series) {
                let a = this.arrays.get(s);
                if (!a) {
                    a = new SeriesVertexArray(this.gl, s);
                    this.arrays.set(s, a);
                }
                a.syncBuffer();
            }
        }
        syncViewport() {
            this.renderWidth = this.width - this.options.renderPaddingLeft - this.options.renderPaddingRight;
            this.renderHeight = this.height - this.options.renderPaddingTop - this.options.renderPaddingBottom;
            const scale = fromValues(this.renderWidth, this.renderHeight);
            divide(scale, [2., 2.], scale);
            this.uniformBuffer.projectionScale.set(scale);
        }
        onResize(width, height) {
            this.height = height;
            this.width = width;
        }
        drawFrame() {
            var _a, _b;
            this.syncBuffer();
            this.syncDomain();
            this.uniformBuffer.upload();
            const gl = this.gl;
            for (const [ds, arr] of this.arrays) {
                if (!ds.visible) {
                    continue;
                }
                const prog = ds.lineType === LineType.NativeLine || ds.lineType === LineType.NativePoint ? this.nativeLineProgram : this.lineProgram;
                prog.use();
                const color = resolveColorRGBA((_a = ds.color) !== null && _a !== void 0 ? _a : this.options.color);
                gl.uniform4fv(prog.locations.uColor, color);
                const lineWidth = (_b = ds.lineWidth) !== null && _b !== void 0 ? _b : this.options.lineWidth;
                if (prog instanceof LineProgram) {
                    gl.uniform1i(prog.locations.uLineType, ds.lineType);
                    gl.uniform1f(prog.locations.uLineWidth, lineWidth / 2);
                    if (ds.lineType === LineType.Step)
                        gl.uniform1f(prog.locations.uStepLocation, ds.stepLocation);
                }
                else {
                    if (ds.lineType === LineType.NativeLine)
                        gl.lineWidth(lineWidth * this.options.pixelRatio); // Not working on most platforms
                    else if (ds.lineType === LineType.NativePoint)
                        gl.uniform1f(prog.locations.uPointSize, lineWidth * this.options.pixelRatio);
                }
                const renderDomain = {
                    min: this.model.xScale.invert(this.options.renderPaddingLeft - lineWidth / 2),
                    max: this.model.xScale.invert(this.width - this.options.renderPaddingRight + lineWidth / 2),
                };
                arr.draw(renderDomain);
            }
            if (this.options.debugWebGL) {
                const err = gl.getError();
                if (err != gl.NO_ERROR) {
                    throw new Error(`WebGL error ${err}`);
                }
            }
        }
        syncDomain() {
            this.syncViewport();
            const m = this.model;
            // for any x,
            // (x - domain[0]) / (domain[1] - domain[0]) * (range[1] - range[0]) + range[0] - W / 2 - padding = s * (x + t)
            // => s = (range[1] - range[0]) / (domain[1] - domain[0])
            //    t = (range[0] - W / 2 - padding) / s - domain[0]
            // Not using vec2 for precision
            const xDomain = m.xScale.domain();
            const xRange = m.xScale.range();
            const yDomain = m.yScale.domain();
            const yRange = m.yScale.range();
            const s = [
                (xRange[1] - xRange[0]) / (xDomain[1] - xDomain[0]),
                (yRange[0] - yRange[1]) / (yDomain[1] - yDomain[0]),
            ];
            const t = [
                (xRange[0] - this.renderWidth / 2 - this.options.renderPaddingLeft) / s[0] - xDomain[0],
                -(yRange[0] - this.renderHeight / 2 - this.options.renderPaddingTop) / s[1] - yDomain[0],
            ];
            this.uniformBuffer.modelScale.set(s);
            this.uniformBuffer.modelTranslate.set(t);
        }
    }
    const lineChart = {
        apply(chart) {
            return new LineChartRenderer(chart.model, chart.canvasLayer.gl, chart.options);
        }
    };

    class NearestPoint {
        constructor(svg, options, model, pModel) {
            this.svg = svg;
            this.options = options;
            this.model = model;
            this.pModel = pModel;
            this.intersectPoints = new Map();
            const initTrans = svg.svgNode.createSVGTransform();
            initTrans.setTranslate(0, 0);
            const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            style.textContent = `
.timechart-crosshair-intersect {
    fill: var(--background-overlay, white);
    visibility: hidden;
}
.timechart-crosshair-intersect circle {
    r: 3px;
}`;
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.classList.add('timechart-crosshair-intersect');
            g.appendChild(style);
            this.container = g;
            this.adjustIntersectPoints();
            svg.svgNode.appendChild(g);
            pModel.updated.on(() => this.adjustIntersectPoints());
        }
        adjustIntersectPoints() {
            var _a, _b;
            const initTrans = this.svg.svgNode.createSVGTransform();
            initTrans.setTranslate(0, 0);
            for (const s of this.options.series) {
                if (!this.intersectPoints.has(s)) {
                    const intersect = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    intersect.transform.baseVal.initialize(initTrans);
                    this.container.appendChild(intersect);
                    this.intersectPoints.set(s, intersect);
                }
                const intersect = this.intersectPoints.get(s);
                intersect.style.stroke = ((_a = s.color) !== null && _a !== void 0 ? _a : this.options.color).toString();
                intersect.style.strokeWidth = `${(_b = s.lineWidth) !== null && _b !== void 0 ? _b : this.options.lineWidth}px`;
                const point = this.pModel.dataPoints.get(s);
                if (!point) {
                    intersect.style.visibility = 'hidden';
                }
                else {
                    intersect.style.visibility = 'visible';
                    const p = this.model.pxPoint(point);
                    intersect.transform.baseVal.getItem(0).setTranslate(p.x, p.y);
                }
            }
        }
    }
    const nearestPoint = {
        apply(chart) {
            return new NearestPoint(chart.svgLayer, chart.options, chart.model, chart.nearestPoint);
        }
    };

    class Tooltip {
        constructor(chart, options) {
            this.options = options;
            this.items = new Map();
            this.chartOptions = chart.options;
            const mouseOffset = 12;
            this.tooltip = document.createElement('chart-tooltip');
            const ls = this.tooltip.style;
            ls.position = 'absolute';
            ls.visibility = "hidden";
            const legendRoot = this.tooltip.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = `
:host {
    background: var(--background-overlay, white);
    border: 1px solid hsl(0, 0%, 80%);
    border-radius: 3px;
    padding: 2px 2px;
}
.item {
    user-select: none;
}
.out-of-range.item {
    display: none;
}
td {
    padding: 0px 5px;
}
.name {
    margin-right: 10px;
    max-width: 100px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}
.example {
    width: 6px;
    height: 6px;
}
.value {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    min-width: 100px;
    max-width: 100px;
    text-align: right;
}
.x-not-aligned .value {
    opacity: 0.4;
}
`;
            legendRoot.appendChild(style);
            const table = document.createElement("table");
            this.xItem = this.createItemElements(this.options.xLabel);
            table.appendChild(this.xItem.item);
            legendRoot.appendChild(table);
            this.itemContainer = table;
            this.update();
            chart.el.shadowRoot.appendChild(this.tooltip);
            chart.model.updated.on(() => this.update());
            chart.model.disposing.on(() => {
                chart.el.shadowRoot.removeChild(this.tooltip);
            });
            chart.nearestPoint.updated.on(() => {
                if (!options.enabled || chart.nearestPoint.dataPoints.size == 0) {
                    ls.visibility = "hidden";
                    return;
                }
                ls.visibility = "visible";
                const p = chart.nearestPoint.lastPointerPos;
                const tooltipRect = this.tooltip.getBoundingClientRect();
                let left = p.x - tooltipRect.width - mouseOffset;
                let top = p.y - tooltipRect.height - mouseOffset;
                if (left < 0)
                    left = p.x + mouseOffset;
                if (top < 0)
                    top = p.y + mouseOffset;
                ls.left = left + "px";
                ls.top = top + "px";
                // display X for the data point that is the closest to the pointer
                let minPointerDistance = Number.POSITIVE_INFINITY;
                let displayingX = null;
                for (const [s, d] of chart.nearestPoint.dataPoints) {
                    const px = chart.model.pxPoint(d);
                    const dx = px.x - p.x;
                    const dy = px.y - p.y;
                    const dis = Math.sqrt(dx * dx + dy * dy);
                    if (dis < minPointerDistance) {
                        minPointerDistance = dis;
                        displayingX = d.x;
                    }
                }
                const xFormatter = options.xFormatter;
                this.xItem.value.textContent = xFormatter(displayingX);
                for (const s of chart.options.series) {
                    if (!s.visible)
                        continue;
                    let point = chart.nearestPoint.dataPoints.get(s);
                    let item = this.items.get(s);
                    if (item) {
                        item.item.classList.toggle('out-of-range', !point);
                        if (point) {
                            item.value.textContent = point.y.toLocaleString();
                            item.item.classList.toggle('x-not-aligned', point.x !== displayingX);
                        }
                    }
                }
            });
        }
        createItemElements(label) {
            const item = document.createElement('tr');
            item.className = 'item';
            const exampleTd = document.createElement('td');
            const example = document.createElement('div');
            example.className = 'example';
            exampleTd.appendChild(example);
            item.appendChild(exampleTd);
            const name = document.createElement('td');
            name.className = "name";
            name.textContent = label;
            item.appendChild(name);
            const value = document.createElement('td');
            value.className = "value";
            item.appendChild(value);
            return { item, example, name, value };
        }
        update() {
            var _a;
            for (const s of this.chartOptions.series) {
                if (!this.items.has(s)) {
                    const itemElements = this.createItemElements(s.name);
                    this.itemContainer.appendChild(itemElements.item);
                    this.items.set(s, itemElements);
                }
                const item = this.items.get(s);
                item.example.style.backgroundColor = ((_a = s.color) !== null && _a !== void 0 ? _a : this.chartOptions.color).toString();
                item.item.style.display = s.visible ? "" : "none";
            }
        }
    }
    const defaultOptions = {
        enabled: false,
        xLabel: "X",
        xFormatter: x => x.toLocaleString(),
    };
    class TimeChartTooltipPlugin {
        constructor(options) {
            if (!options)
                options = {};
            if (!defaultOptions.isPrototypeOf(options))
                Object.setPrototypeOf(options, defaultOptions);
            this.options = options;
        }
        apply(chart) {
            return new Tooltip(chart, this.options);
        }
    }

    function addDefaultPlugins(options) {
        var _a;
        const o = options !== null && options !== void 0 ? options : { plugins: undefined, zoom: undefined, tooltip: undefined };
        return Object.assign(Object.assign({}, options), { plugins: Object.assign({ lineChart,
                d3Axis,
                crosshair,
                nearestPoint,
                legend, zoom: new TimeChartZoomPlugin(o.zoom), tooltip: new TimeChartTooltipPlugin(o.tooltip) }, ((_a = o.plugins) !== null && _a !== void 0 ? _a : {})) });
    }
    class TimeChart extends TimeChart$1 {
        get options() { return this._options; }
        constructor(el, options) {
            super(el, addDefaultPlugins(options));
            this.el = el;
        }
    }
    // For users who use script tag
    TimeChart.core = TimeChart$1;
    TimeChart.plugins = {
        lineChart,
        d3Axis,
        crosshair,
        nearestPoint,
        legend,
        TimeChartZoomPlugin,
        TimeChartTooltipPlugin,
    };
    TimeChart.LineType = LineType;

    return TimeChart;

}));
//# sourceMappingURL=timechart.umd.js.map
