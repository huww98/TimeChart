import { resolveColorRGBA } from '../options';
import { domainSearch } from '../utils';
import { vec2 } from 'gl-matrix';
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
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
    const body = `
`;
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
        const vDP = vec2.create();
        const vPreviousDP = vec2.create();
        const dir1 = vec2.create();
        const dir2 = vec2.create();
        function calc(dp, previousDP) {
            vDP[0] = dp.x;
            vDP[1] = dp.y;
            vPreviousDP[0] = previousDP.x;
            vPreviousDP[1] = previousDP.y;
            vec2.subtract(dir1, vDP, vPreviousDP);
            vec2.normalize(dir1, dir1);
            vec2.negate(dir2, dir1);
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
export class LineChartRenderer {
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
        const scale = vec2.fromValues(width, height);
        vec2.divide(scale, scale, [2, 2]);
        vec2.inverse(scale, scale);
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
export const lineChart = {
    apply(chart) {
        return new LineChartRenderer(chart.model, chart.canvasLayer.gl, chart.options);
    }
};
//# sourceMappingURL=lineChart.js.map