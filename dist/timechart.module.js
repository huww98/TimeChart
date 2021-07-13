import { rgb } from 'd3-color';
import { scaleLinear, scaleTime } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { select } from 'd3-selection';

function resolveColorRGBA(color) {
    const rgbColor = typeof color === 'string' ? rgb(color) : rgb(color);
    return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255, rgbColor.opacity];
}

function getContext(canvas, forceWebGL1) {
    if (!forceWebGL1) {
        const ctx = canvas.getContext('webgl2');
        if (ctx) {
            return ctx;
        }
    }
    const ctx = canvas.getContext('webgl');
    if (ctx) {
        return ctx;
    }
    throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.');
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
        this.gl = getContext(canvas, options.forceWebGL1);
        const bgColor = resolveColorRGBA(options.backgroundColor);
        this.gl.clearColor(...bgColor);
        this.canvas = canvas;
        model.updated.on(() => this.clear());
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
    onResize(width, height) {
        const canvas = this.canvas;
        const scale = this.options.pixelRatio;
        canvas.width = width * scale;
        canvas.height = height * scale;
        this.gl.viewport(0, 0, canvas.width, canvas.height);
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
        this.points = new Map();
        this.lastX = null;
        this.updated = new EventDispatcher();
        detector.node.addEventListener('mousemove', ev => {
            const rect = canvas.canvas.getBoundingClientRect();
            this.lastX = ev.clientX - rect.left;
            this.adjustPoints();
        });
        detector.node.addEventListener('mouseleave', ev => {
            this.lastX = null;
            this.adjustPoints();
        });
        model.updated.on(() => this.adjustPoints());
    }
    adjustPoints() {
        if (this.lastX === null) {
            this.points.clear();
        }
        else {
            const domain = this.model.xScale.invert(this.lastX);
            for (const s of this.options.series) {
                if (s.data.length == 0 || !s.visible) {
                    this.points.delete(s);
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
                    this.points.set(s, pxPoint);
                }
                else {
                    this.points.delete(s);
                }
            }
        }
        this.updated.dispatch();
    }
}

function maxMin(arr) {
    let max = -Infinity;
    let min = Infinity;
    for (const v of arr) {
        if (v > max)
            max = v;
        if (v < min)
            min = v;
    }
    return { max, min };
}
class RenderModel {
    constructor(options) {
        this.options = options;
        this.xScale = scaleLinear();
        this.yScale = scaleLinear();
        this.xRange = null;
        this.yRange = null;
        this.seriesInfo = new Map();
        this.resized = new EventDispatcher();
        this.updated = new EventDispatcher();
        this.disposing = new EventDispatcher();
        this.disposed = false;
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
        if (!this.disposed) {
            this.disposing.dispatch();
            this.disposed = true;
        }
    }
    update() {
        this.updateModel();
        this.updated.dispatch();
    }
    updateModel() {
        for (const s of this.options.series) {
            if (!this.seriesInfo.has(s)) {
                this.seriesInfo.set(s, {
                    yRangeUpdatedIndex: 0,
                });
            }
        }
        const series = this.options.series.filter(s => s.data.length > 0);
        if (series.length === 0) {
            return;
        }
        const opXRange = this.options.xRange;
        const opYRange = this.options.yRange;
        {
            const maxDomain = Math.max(...series.map(s => s.data[s.data.length - 1].x));
            const minDomain = this.xRange?.min ?? Math.min(...series.map(s => s.data[0].x));
            this.xRange = { max: maxDomain, min: minDomain };
            if (this.options.realTime || opXRange === 'auto') {
                if (this.options.realTime) {
                    const currentDomain = this.xScale.domain();
                    const range = currentDomain[1] - currentDomain[0];
                    this.xScale.domain([maxDomain - range, maxDomain]);
                }
                else { // Auto
                    this.xScale.domain([minDomain, maxDomain]);
                }
            }
            else if (opXRange) {
                this.xScale.domain([opXRange.min, opXRange.max]);
            }
        }
        {
            const maxMinY = series.map(s => {
                const newY = s.data.slice(this.seriesInfo.get(s).yRangeUpdatedIndex).map(d => d.y);
                return maxMin(newY);
            });
            if (this.yRange) {
                maxMinY.push(this.yRange);
            }
            const minDomain = Math.min(...maxMinY.map(s => s.min));
            const maxDomain = Math.max(...maxMinY.map(s => s.max));
            this.yRange = { max: maxDomain, min: minDomain };
            if (opYRange === 'auto') {
                this.yScale.domain([minDomain, maxDomain]).nice();
                for (const s of series) {
                    this.seriesInfo.get(s).yRangeUpdatedIndex = s.data.length;
                }
            }
            else if (opYRange) {
                this.yScale.domain([opYRange.min, opYRange.max]);
            }
        }
    }
    requestRedraw() {
        if (this.redrawRequested) {
            return;
        }
        this.redrawRequested = true;
        requestAnimationFrame((time) => {
            this.redrawRequested = false;
            if (!this.disposed) {
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

const defaultOptions = {
    pixelRatio: window.devicePixelRatio,
    lineWidth: 1,
    backgroundColor: rgb(0, 0, 0, 0),
    paddingTop: 10,
    paddingRight: 10,
    paddingLeft: 45,
    paddingBottom: 20,
    xRange: 'auto',
    yRange: 'auto',
    realTime: false,
    baseTime: 0,
    xScaleType: scaleTime,
    debugWebGL: false,
    forceWebGL1: false,
    legend: true,
};
const defaultSeriesOptions = {
    name: '',
    visible: true,
};
class TimeChart$1 {
    constructor(el, options) {
        this.el = el;
        this.disposed = false;
        const o = options ?? { series: undefined, plugins: undefined };
        const series = o.series?.map(s => this.completeSeriesOptions(s)) ?? [];
        const coreOptions = {
            ...defaultOptions,
            ...options,
            series,
        };
        this.model = new RenderModel(coreOptions);
        const shadowRoot = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
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
        if (o.plugins === undefined) {
            this.plugins = {};
        }
        else {
            this.plugins = Object.fromEntries(Object.entries(o.plugins).map(([name, p]) => [name, p.apply(this)]));
        }
        this.onResize();
        const resizeHandler = () => this.onResize();
        window.addEventListener('resize', resizeHandler);
        this.model.disposing.on(() => {
            window.removeEventListener('resize', resizeHandler);
            shadowRoot.removeChild(style);
        });
    }
    get options() { return this._options; }
    completeSeriesOptions(s) {
        return {
            data: [],
            ...defaultSeriesOptions,
            color: getComputedStyle(this.el).getPropertyValue('color'),
            ...s,
            _complete: true,
        };
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
            if (!s._complete) {
                this.options.series[i] = this.completeSeriesOptions(s);
            }
        }
        this.model.requestRedraw();
    }
    dispose() {
        this.model.dispose();
        this.disposed = true;
    }
}

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
        el.style.userSelect = 'none';
        el.addEventListener('pointerdown', ev => this.onMouseDown(ev));
        el.addEventListener('pointerup', ev => this.onMouseUp(ev));
        el.addEventListener('pointermove', ev => this.onMouseMove(ev));
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
        if (event.pointerType !== 'mouse') {
            return;
        }
        this.el.setPointerCapture(event.pointerId);
        this.previousPoint = this.point(event);
        this.el.style.cursor = 'grabbing';
    }
    onMouseUp(event) {
        if (this.previousPoint === null) {
            return;
        }
        this.previousPoint = null;
        this.el.releasePointerCapture(event.pointerId);
        this.el.style.cursor = '';
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
        el.addEventListener('touchstart', e => this.onTouchStart(e), { passive: true });
        el.addEventListener('touchend', e => this.onTouchEnd(e), { passive: true });
        el.addEventListener('touchcancel', e => this.onTouchEnd(e), { passive: true });
        el.addEventListener('touchmove', e => this.onTouchMove(e), { passive: true });
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
        if (event.touches.length < 2) {
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
        el.addEventListener('wheel', ev => this.onWheel(ev));
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
        if (event.ctrlKey) { // zoom
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
class ChartZoom {
    constructor(el, options) {
        this.scaleUpdated = new EventDispatcher();
        options = options ?? {};
        this.options = {
            x: options.x && { ...defaultAxisOptions, ...options.x },
            y: options.y && { ...defaultAxisOptions, ...options.y },
        };
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
        this.options = this.registerZoom(chart, options);
    }
    applyAutoRange(o, dataRange) {
        if (!o || !o.autoRange) {
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
    registerZoom(chart, zoomOptions) {
        const z = new ChartZoom(chart.contentBoxDetector.node, {
            x: zoomOptions.x && {
                ...zoomOptions.x,
                scale: chart.model.xScale,
            },
            y: zoomOptions.y && {
                ...zoomOptions.y,
                scale: chart.model.yScale,
            }
        });
        const resolvedOptions = z.options;
        chart.model.updated.on(() => {
            this.applyAutoRange(resolvedOptions.x, chart.model.xRange);
            this.applyAutoRange(resolvedOptions.y, chart.model.yRange);
            z.update();
        });
        z.onScaleUpdated(() => {
            chart.options.xRange = null;
            chart.options.yRange = null;
            chart.options.realTime = false;
            chart.update();
        });
        return resolvedOptions;
    }
}
class TimeChartZoomPlugin {
    constructor(o) {
        this.o = o;
    }
    apply(chart) {
        return new TimeChartZoom(chart, this.o);
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
        const d3Svg = select(chart.svgLayer.svgNode);
        const xg = d3Svg.append('g');
        const yg = d3Svg.append('g');
        const xAxis = axisBottom(chart.model.xScale);
        const yAxis = axisLeft(chart.model.yScale);
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
            item.example.style.height = `${s.lineWidth ?? this.options.lineWidth}px`;
            item.example.style.backgroundColor = s.color.toString();
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
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */

function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
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
 * Negates the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to negate
 * @returns {vec2} out
 */

function negate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  return out;
}
/**
 * Returns the inverse of the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to invert
 * @returns {vec2} out
 */

function inverse(out, a) {
  out[0] = 1.0 / a[0];
  out[1] = 1.0 / a[1];
  return out;
}
/**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to normalize
 * @returns {vec2} out
 */

function normalize(out, a) {
  var x = a[0],
      y = a[1];
  var len = x * x + y * y;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
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
        const gl = this.gl;
        const program = this.program;
        gl.linkProgram(program);
        if (this.debug) {
            const success = gl.getProgramParameter(program, gl.LINK_STATUS);
            if (!success) {
                const message = gl.getProgramInfoLog(program) ?? 'Unknown Error.';
                gl.deleteProgram(program);
                throw new Error(message);
            }
        }
    }
    use() {
        this.gl.useProgram(this.program);
    }
}
function createShader(gl, type, source, debug) {
    const shader = throwIfFalsy(gl.createShader(type));
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (debug) {
        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            const message = gl.getShaderInfoLog(shader) ?? 'Unknown Error.';
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

function vsSource(gl) {
    const body = `
uniform vec2 uModelScale;
uniform vec2 uModelTranslation;
uniform vec2 uProjectionScale;
uniform float uLineWidth;

void main() {
    vec2 cssPose = uModelScale * aDataPoint + uModelTranslation;
    vec2 dir = uModelScale * aDir;
    dir = normalize(dir);
    vec2 pos2d = uProjectionScale * (cssPose + vec2(-dir.y, dir.x) * uLineWidth);
    gl_Position = vec4(pos2d, 0, 1);
}`;
    if (gl instanceof WebGLRenderingContext) {
        return `
attribute vec2 aDataPoint;
attribute vec2 aDir;
${body}`;
    }
    else {
        return `#version 300 es
layout (location = ${0 /* DATA_POINT */}) in vec2 aDataPoint;
layout (location = ${1 /* DIR */}) in vec2 aDir;
${body}`;
    }
}
function fsSource(gl) {
    if (gl instanceof WebGLRenderingContext) {
        return `
precision lowp float;
uniform vec4 uColor;
void main() {
    gl_FragColor = uColor;
}`;
    }
    else {
        return `#version 300 es
precision lowp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
    outColor = uColor;
}`;
    }
}
class LineChartWebGLProgram extends LinkedWebGLProgram {
    constructor(gl, debug) {
        super(gl, vsSource(gl), fsSource(gl), debug);
        if (gl instanceof WebGLRenderingContext) {
            gl.bindAttribLocation(this.program, 0 /* DATA_POINT */, 'aDataPoint');
            gl.bindAttribLocation(this.program, 1 /* DIR */, 'aDir');
        }
        this.link();
        const getLoc = (name) => throwIfFalsy(gl.getUniformLocation(this.program, name));
        this.locations = {
            uModelScale: getLoc('uModelScale'),
            uModelTranslation: getLoc('uModelTranslation'),
            uProjectionScale: getLoc('uProjectionScale'),
            uLineWidth: getLoc('uLineWidth'),
            uColor: getLoc('uColor'),
        };
    }
}
const INDEX_PER_POINT = 4;
const POINT_PER_DATAPOINT = 4;
const INDEX_PER_DATAPOINT = INDEX_PER_POINT * POINT_PER_DATAPOINT;
const BYTES_PER_POINT = INDEX_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
const BUFFER_DATA_POINT_CAPACITY = 128 * 1024;
const BUFFER_CAPACITY = BUFFER_DATA_POINT_CAPACITY * INDEX_PER_DATAPOINT + 2 * POINT_PER_DATAPOINT;
class WebGL2VAO {
    constructor(gl) {
        this.gl = gl;
        this.vao = throwIfFalsy(gl.createVertexArray());
        this.bind();
    }
    bind() {
        this.gl.bindVertexArray(this.vao);
    }
    clear() {
        this.gl.deleteVertexArray(this.vao);
    }
}
class OESVAO {
    constructor(vaoExt) {
        this.vaoExt = vaoExt;
        this.vao = throwIfFalsy(vaoExt.createVertexArrayOES());
        this.bind();
    }
    bind() {
        this.vaoExt.bindVertexArrayOES(this.vao);
    }
    clear() {
        this.vaoExt.deleteVertexArrayOES(this.vao);
    }
}
class WebGL1BufferInfo {
    constructor(bindFunc) {
        this.bindFunc = bindFunc;
    }
    bind() {
        this.bindFunc();
    }
    clear() {
    }
}
class SeriesSegmentVertexArray {
    /**
     * @param firstDataPointIndex At least 1, since datapoint 0 has no path to draw.
     */
    constructor(gl, dataPoints, firstDataPointIndex) {
        this.gl = gl;
        this.dataPoints = dataPoints;
        this.firstDataPointIndex = firstDataPointIndex;
        this.length = 0;
        this.dataBuffer = throwIfFalsy(gl.createBuffer());
        const bindFunc = () => {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
            gl.enableVertexAttribArray(0 /* DATA_POINT */);
            gl.vertexAttribPointer(0 /* DATA_POINT */, 2, gl.FLOAT, false, BYTES_PER_POINT, 0);
            gl.enableVertexAttribArray(1 /* DIR */);
            gl.vertexAttribPointer(1 /* DIR */, 2, gl.FLOAT, false, BYTES_PER_POINT, 2 * Float32Array.BYTES_PER_ELEMENT);
        };
        if (gl instanceof WebGLRenderingContext) {
            const vaoExt = gl.getExtension('OES_vertex_array_object');
            if (vaoExt) {
                this.vao = new OESVAO(vaoExt);
            }
            else {
                this.vao = new WebGL1BufferInfo(bindFunc);
            }
        }
        else {
            this.vao = new WebGL2VAO(gl);
        }
        bindFunc();
        gl.bufferData(gl.ARRAY_BUFFER, BUFFER_CAPACITY * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    }
    clear() {
        this.length = 0;
    }
    delete() {
        this.clear();
        this.gl.deleteBuffer(this.dataBuffer);
        this.vao.clear();
    }
    /**
     * @returns Next data point index, or `dataPoints.length` if all data added.
     */
    addDataPoints() {
        const dataPoints = this.dataPoints;
        const start = this.firstDataPointIndex + this.length;
        const remainDPCapacity = BUFFER_DATA_POINT_CAPACITY - this.length;
        const remainDPCount = dataPoints.length - start;
        const isOverflow = remainDPCapacity < remainDPCount;
        const numDPtoAdd = isOverflow ? remainDPCapacity : remainDPCount;
        let extraBufferLength = INDEX_PER_DATAPOINT * numDPtoAdd;
        if (isOverflow) {
            extraBufferLength += 2 * INDEX_PER_POINT;
        }
        const buffer = new Float32Array(extraBufferLength);
        let bi = 0;
        const vDP = create();
        const vPreviousDP = create();
        const dir1 = create();
        const dir2 = create();
        function calc(dp, previousDP) {
            vDP[0] = dp.x;
            vDP[1] = dp.y;
            vPreviousDP[0] = previousDP.x;
            vPreviousDP[1] = previousDP.y;
            subtract(dir1, vDP, vPreviousDP);
            normalize(dir1, dir1);
            negate(dir2, dir1);
        }
        function put(v) {
            buffer[bi] = v[0];
            buffer[bi + 1] = v[1];
            bi += 2;
        }
        let previousDP = dataPoints[start - 1];
        for (let i = 0; i < numDPtoAdd; i++) {
            const dp = dataPoints[start + i];
            calc(dp, previousDP);
            previousDP = dp;
            for (const dp of [vPreviousDP, vDP]) {
                for (const dir of [dir1, dir2]) {
                    put(dp);
                    put(dir);
                }
            }
        }
        if (isOverflow) {
            calc(dataPoints[start + numDPtoAdd], previousDP);
            for (const dir of [dir1, dir2]) {
                put(vPreviousDP);
                put(dir);
            }
        }
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, BYTES_PER_POINT * POINT_PER_DATAPOINT * this.length, buffer);
        this.length += numDPtoAdd;
        return start + numDPtoAdd;
    }
    draw(renderIndex) {
        const first = Math.max(0, renderIndex.min - this.firstDataPointIndex);
        const last = Math.min(this.length, renderIndex.max - this.firstDataPointIndex);
        const count = last - first;
        const gl = this.gl;
        this.vao.bind();
        gl.drawArrays(gl.TRIANGLE_STRIP, first * POINT_PER_DATAPOINT, count * POINT_PER_DATAPOINT);
    }
}
/**
 * An array of `SeriesSegmentVertexArray` to represent a series
 *
 * `series.data`  index: 0  [1 ... C] [C+1 ... 2C] ... (C = `BUFFER_DATA_POINT_CAPACITY`)
 * `vertexArrays` index:     0         1           ...
 */
class SeriesVertexArray {
    constructor(gl, series) {
        this.gl = gl;
        this.series = series;
        this.vertexArrays = [];
    }
    syncBuffer() {
        let activeArray;
        let bufferedDataPointNum = 1;
        const newArray = () => {
            activeArray = new SeriesSegmentVertexArray(this.gl, this.series.data, bufferedDataPointNum);
            this.vertexArrays.push(activeArray);
        };
        if (this.vertexArrays.length > 0) {
            const lastVertexArray = this.vertexArrays[this.vertexArrays.length - 1];
            bufferedDataPointNum = lastVertexArray.firstDataPointIndex + lastVertexArray.length;
            if (bufferedDataPointNum > this.series.data.length) {
                throw new Error('remove data unsupported.');
            }
            if (bufferedDataPointNum === this.series.data.length) {
                return;
            }
            activeArray = lastVertexArray;
        }
        else if (this.series.data.length >= 2) {
            newArray();
            activeArray = activeArray;
        }
        else {
            return; // Not enough data
        }
        while (true) {
            bufferedDataPointNum = activeArray.addDataPoints();
            if (bufferedDataPointNum >= this.series.data.length) {
                if (bufferedDataPointNum > this.series.data.length) {
                    throw Error('Assertion failed.');
                }
                break;
            }
            newArray();
        }
    }
    draw(renderDomain) {
        const data = this.series.data;
        if (this.vertexArrays.length === 0 || data[0].x > renderDomain.max || data[data.length - 1].x < renderDomain.min) {
            return;
        }
        const key = (d) => d.x;
        const minIndex = domainSearch(data, 1, data.length, renderDomain.min, key);
        const maxIndex = domainSearch(data, minIndex, data.length - 1, renderDomain.max, key) + 1;
        const minArrayIndex = Math.floor((minIndex - 1) / BUFFER_DATA_POINT_CAPACITY);
        const maxArrayIndex = Math.ceil((maxIndex - 1) / BUFFER_DATA_POINT_CAPACITY);
        const renderIndex = { min: minIndex, max: maxIndex };
        for (let i = minArrayIndex; i < maxArrayIndex; i++) {
            this.vertexArrays[i].draw(renderIndex);
        }
    }
}
class LineChartRenderer {
    constructor(model, gl, options) {
        this.model = model;
        this.gl = gl;
        this.options = options;
        this.program = new LineChartWebGLProgram(this.gl, this.options.debugWebGL);
        this.arrays = new Map();
        this.height = 0;
        this.width = 0;
        this.program.use();
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
    onResize(width, height) {
        this.height = height;
        this.width = width;
        const scale = fromValues(width, height);
        divide(scale, scale, [2, 2]);
        inverse(scale, scale);
        const gl = this.gl;
        gl.uniform2fv(this.program.locations.uProjectionScale, scale);
    }
    drawFrame() {
        this.syncBuffer();
        this.syncDomain();
        const gl = this.gl;
        for (const [ds, arr] of this.arrays) {
            if (!ds.visible) {
                continue;
            }
            const color = resolveColorRGBA(ds.color);
            gl.uniform4fv(this.program.locations.uColor, color);
            const lineWidth = ds.lineWidth ?? this.options.lineWidth;
            gl.uniform1f(this.program.locations.uLineWidth, lineWidth / 2);
            const renderDomain = {
                min: this.model.xScale.invert(-lineWidth / 2),
                max: this.model.xScale.invert(this.width + lineWidth / 2),
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
    ySvgToView(v) {
        return -v + this.height / 2;
    }
    xSvgToView(v) {
        return v - this.width / 2;
    }
    syncDomain() {
        const m = this.model;
        const gl = this.gl;
        const zero = [this.xSvgToView(m.xScale(0)), this.ySvgToView(m.yScale(0))];
        const one = [this.xSvgToView(m.xScale(1)), this.ySvgToView(m.yScale(1))];
        // Not using vec2 for precision
        const scaling = [one[0] - zero[0], one[1] - zero[1]];
        gl.uniform2fv(this.program.locations.uModelScale, scaling);
        gl.uniform2fv(this.program.locations.uModelTranslation, zero);
    }
}
const lineChart = {
    apply(chart) {
        return new LineChartRenderer(chart.model, chart.canvasLayer.gl, chart.options);
    }
};

class NearestPoint {
    constructor(svg, options, pModel) {
        this.svg = svg;
        this.options = options;
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
        const initTrans = this.svg.svgNode.createSVGTransform();
        initTrans.setTranslate(0, 0);
        for (const s of this.options.series) {
            if (!this.intersectPoints.has(s)) {
                const intersect = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                intersect.style.stroke = s.color.toString();
                intersect.style.strokeWidth = `${s.lineWidth ?? this.options.lineWidth}px`;
                intersect.transform.baseVal.initialize(initTrans);
                this.container.appendChild(intersect);
                this.intersectPoints.set(s, intersect);
            }
            const intersect = this.intersectPoints.get(s);
            const point = this.pModel.points.get(s);
            if (!point) {
                intersect.style.visibility = 'hidden';
            }
            else {
                intersect.style.visibility = 'visible';
                intersect.transform.baseVal.getItem(0).setTranslate(point.x, point.y);
            }
        }
    }
}
const nearestPoint = {
    apply(chart) {
        return new NearestPoint(chart.svgLayer, chart.options, chart.nearestPoint);
    }
};

function addDefaultPlugins(options) {
    const o = options ?? { plugins: undefined, zoom: undefined };
    return {
        ...options,
        plugins: {
            ...(o.plugins ?? {}),
            lineChart,
            d3Axis,
            crosshair,
            nearestPoint,
            legend,
            zoom: new TimeChartZoomPlugin(o.zoom ?? {})
        }
    };
}
class TimeChart extends TimeChart$1 {
    constructor(el, options) {
        super(el, addDefaultPlugins(options));
        this.el = el;
        const zoom = this.plugins.zoom;
        this._options = Object.assign(super.options, { zoom: zoom.options });
    }
    get options() { return this._options; }
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
};

export default TimeChart;
//# sourceMappingURL=timechart.module.js.map
