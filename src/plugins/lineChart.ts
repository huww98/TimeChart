import { DataPoint, RenderModel } from "../core/renderModel";
import { resolveColorRGBA, ResolvedCoreOptions, TimeChartSeriesOptions } from '../options';
import { domainSearch } from '../utils';
import { vec2 } from 'gl-matrix';
import { TimeChartPlugin } from '.';
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { DataPointsBuffer } from "../core/dataPointsBuffer";


const enum VertexAttribLocations {
    DATA_POINT = 0,
    DIR = 1,
}

function vsSource(gl: WebGL2RenderingContext | WebGLRenderingContext) {
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
    } else {
        return `#version 300 es
layout (location = ${VertexAttribLocations.DATA_POINT}) in vec2 aDataPoint;
layout (location = ${VertexAttribLocations.DIR}) in vec2 aDir;
${body}`;
    }
}

function fsSource(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const body = `
`;
    if (gl instanceof WebGLRenderingContext) {
        return `
precision lowp float;
uniform vec4 uColor;
void main() {
    gl_FragColor = uColor;
}`;
    } else {
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
    locations: {
        uModelScale: WebGLUniformLocation;
        uModelTranslation: WebGLUniformLocation;
        uProjectionScale: WebGLUniformLocation;
        uLineWidth: WebGLUniformLocation;
        uColor: WebGLUniformLocation;
    };
    constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, debug: boolean) {
        super(gl, vsSource(gl), fsSource(gl), debug);

        if (gl instanceof WebGLRenderingContext) {
            gl.bindAttribLocation(this.program, VertexAttribLocations.DATA_POINT, 'aDataPoint');
            gl.bindAttribLocation(this.program, VertexAttribLocations.DIR, 'aDir');
        }

        this.link();

        const getLoc = (name: string) => throwIfFalsy(gl.getUniformLocation(this.program, name));

        this.locations = {
            uModelScale: getLoc('uModelScale'),
            uModelTranslation: getLoc('uModelTranslation'),
            uProjectionScale: getLoc('uProjectionScale'),
            uLineWidth: getLoc('uLineWidth'),
            uColor: getLoc('uColor'),
        }
    }
}

const INDEX_PER_POINT = 4;
const POINT_PER_DATAPOINT = 4;
const INDEX_PER_DATAPOINT = INDEX_PER_POINT * POINT_PER_DATAPOINT;
const BYTES_PER_POINT = INDEX_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
const BUFFER_DATA_POINT_CAPACITY = 128 * 1024;
const BUFFER_POINT_CAPACITY = BUFFER_DATA_POINT_CAPACITY * POINT_PER_DATAPOINT + 2;
const BUFFER_CAPACITY = BUFFER_POINT_CAPACITY * INDEX_PER_POINT;

interface IVAO {
    bind(): void;
    clear(): void;
}

class WebGL2VAO implements IVAO {
    private vao: WebGLVertexArrayObject;
    constructor(private gl: WebGL2RenderingContext) {
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

class OESVAO implements IVAO {
    vao: WebGLVertexArrayObjectOES;
    constructor(private vaoExt: OES_vertex_array_object) {
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

class WebGL1BufferInfo implements IVAO {
    constructor(private bindFunc: () => void) {
    }
    bind() {
        this.bindFunc();
    }
    clear() {
    }
}

class SeriesSegmentVertexArray {
    vao: IVAO;
    dataBuffer: WebGLBuffer;
    validStart = 0;
    validEnd = 0;

    constructor(
        private gl: WebGL2RenderingContext | WebGLRenderingContext,
        private dataPoints: DataPointsBuffer,
    ) {
        this.dataBuffer = throwIfFalsy(gl.createBuffer());
        const bindFunc = () => {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);

            gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT);
            gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT, 2, gl.FLOAT, false, BYTES_PER_POINT, 0);

            gl.enableVertexAttribArray(VertexAttribLocations.DIR);
            gl.vertexAttribPointer(VertexAttribLocations.DIR, 2, gl.FLOAT, false, BYTES_PER_POINT, 2 * Float32Array.BYTES_PER_ELEMENT);
        }
        if (gl instanceof WebGLRenderingContext) {
            const vaoExt = gl.getExtension('OES_vertex_array_object');
            if (vaoExt) {
                this.vao = new OESVAO(vaoExt);
            } else {
                this.vao = new WebGL1BufferInfo(bindFunc);
            }
        } else {
            this.vao = new WebGL2VAO(gl);
        }
        bindFunc();

        gl.bufferData(gl.ARRAY_BUFFER, BUFFER_CAPACITY * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    }

    clear() {
        this.validStart = this.validEnd = 0;
    }

    delete() {
        this.clear();
        this.gl.deleteBuffer(this.dataBuffer);
        this.vao.clear();
    }

    /** pop 0 means just remove the overflow
     *
     * @returns Number of datapoints remaining to be removed. Or less than 0 if all removing finished
     */
    popBack(n: number): number {
        const newVaildEndDP = Math.floor(this.validEnd / POINT_PER_DATAPOINT) - n;
        this.validEnd = Math.max(newVaildEndDP * POINT_PER_DATAPOINT, this.validStart);
        return Math.floor(this.validStart / POINT_PER_DATAPOINT) - newVaildEndDP;
    }

    popFront(n: number): number {
        const newVaildStartDP = Math.floor(this.validStart / POINT_PER_DATAPOINT) + n;
        this.validStart = Math.min(newVaildStartDP * POINT_PER_DATAPOINT, this.validEnd);
        return newVaildStartDP - Math.floor(this.validEnd / POINT_PER_DATAPOINT);
    }

    private syncPoints(start: number, bufferStart: number, bufferEnd: number) {
        const dataPoints = this.dataPoints;
        const n = bufferEnd - bufferStart;
        const buffer = new Float32Array(n * INDEX_PER_POINT);
        let bi = 0;
        const vDP = vec2.create()
        const vPreviousDP = vec2.create()
        const dir1 = vec2.create();
        const dir2 = vec2.create();

        function calc(dp: DataPoint, previousDP: DataPoint) {
            vDP[0] = dp.x;
            vDP[1] = dp.y;
            vPreviousDP[0] = previousDP.x;
            vPreviousDP[1] = previousDP.y;
            vec2.subtract(dir1, vDP, vPreviousDP);
            vec2.normalize(dir1, dir1);
            vec2.negate(dir2, dir1);
        }

        function put(v: vec2) {
            buffer[bi] = v[0];
            buffer[bi + 1] = v[1];
            bi += 2;
        }

        const numDPtoAdd = Math.floor(n / POINT_PER_DATAPOINT)
        let previousDP = dataPoints[start - 1];
        for (let i = 0; i < numDPtoAdd; i++) {
            const dp = dataPoints[start + i];
            calc(dp, previousDP);
            previousDP = dp;

            put(vPreviousDP);
            put(dir1);
            put(vPreviousDP);
            put(dir2);

            put(vDP);
            put(dir1);
            put(vDP);
            put(dir2);
        }

        if (bi < buffer.length) {  // Overflow
            calc(dataPoints[start + numDPtoAdd], previousDP);
            put(vPreviousDP);
            put(dir1);
            put(vPreviousDP);
            put(dir2);
        }
        if (bi !== buffer.length)
            throw Error('BUG!')

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, BYTES_PER_POINT * bufferStart, buffer);
    }

    /**
     * @returns Number of datapoints remaining to be added.
     */
    pushBack(n: number): number {
        if (this.validStart === this.validEnd)
            this.validStart = this.validEnd = 0;

        const oldValidEnd = this.validEnd;
        this.validEnd = Math.min(BUFFER_POINT_CAPACITY, this.validEnd + n * POINT_PER_DATAPOINT);
        const numDPtoAdd = Math.floor((this.validEnd - oldValidEnd) / POINT_PER_DATAPOINT);
        this.syncPoints(this.dataPoints.length - n, oldValidEnd, this.validEnd);

        return n - numDPtoAdd;
    }

    pushFront(n: number): number {
        if (this.validStart === this.validEnd)
            this.validStart = this.validEnd = BUFFER_POINT_CAPACITY;

        const oldVaildStart = this.validStart;
        this.validStart = Math.max(0,  (Math.floor(this.validStart / POINT_PER_DATAPOINT) - n) * POINT_PER_DATAPOINT);
        const numDPtoAdd = Math.floor((oldVaildStart - this.validStart) / POINT_PER_DATAPOINT);
        this.syncPoints(n - numDPtoAdd + 1, this.validStart, oldVaildStart);

        return n - numDPtoAdd;
    }

    draw(renderIndex: { min: number, max: number }) {
        const first = Math.max(this.validStart, renderIndex.min * POINT_PER_DATAPOINT);
        const last = Math.min(this.validEnd, renderIndex.max * POINT_PER_DATAPOINT)
        const count = last - first

        const gl = this.gl;
        this.vao.bind();
        gl.drawArrays(gl.TRIANGLE_STRIP, first, count);
        return Math.floor(count / POINT_PER_DATAPOINT);
    }
}

/**
 * An array of `SeriesSegmentVertexArray` to represent a series
 *
 * `series.data[0]` is not part of any VertexArray.
 */
class SeriesVertexArray {
    private vertexArrays = [] as SeriesSegmentVertexArray[];
    constructor(
        private gl: WebGL2RenderingContext | WebGLRenderingContext,
        private series: TimeChartSeriesOptions,
    ) {
    }

    private popFront() {
        let numDPtoDelete = this.series.data.poped_front;
        if (numDPtoDelete === 0)
            return;

        while (true) {
            const activeArray = this.vertexArrays[0];
            numDPtoDelete = activeArray.popFront(numDPtoDelete);
            if (numDPtoDelete < 0)
                break;
            activeArray.delete();
            this.vertexArrays.shift();
        }
    }
    private popBack() {
        let numDPtoDelete = this.series.data.poped_back;
        if (numDPtoDelete === 0)
            return;

        while (true) {
            const activeArray = this.vertexArrays[this.vertexArrays.length - 1];
            numDPtoDelete = activeArray.popBack(numDPtoDelete);
            if (numDPtoDelete < 0)
                break;
            activeArray.delete();
            this.vertexArrays.pop();
        }
    }

    private newArray() {
        return new SeriesSegmentVertexArray(this.gl, this.series.data);
    }
    private pushFront() {
        let numDPtoAdd = this.series.data.pushed_front;
        if (numDPtoAdd === 0)
            return;

        let activeArray: SeriesSegmentVertexArray;

        const newArray = () => {
            activeArray = this.newArray();
            this.vertexArrays.unshift(activeArray);
        }

        if (this.vertexArrays.length === 0) {
            if (numDPtoAdd < 2)
                return; // Not enough data
            newArray();
            numDPtoAdd--;
        }
        activeArray = this.vertexArrays[0];

        while (true) {
            numDPtoAdd = activeArray.pushFront(numDPtoAdd);
            if (numDPtoAdd <= 0)
                break;
            newArray();
        }
    }

    private pushBack() {
        let numDPtoAdd = this.series.data.pushed_back;
        if (numDPtoAdd === 0)
            return

        let activeArray: SeriesSegmentVertexArray;

        const newArray = () => {
            activeArray = this.newArray();
            this.vertexArrays.push(activeArray);
        }

        if (this.vertexArrays.length === 0) {
            if (numDPtoAdd < 2) {
                return; // Not enough data
            }
            newArray();
            numDPtoAdd--;
        }
        activeArray = this.vertexArrays[this.vertexArrays.length - 1];

        while (true) {
            numDPtoAdd = activeArray.pushBack(numDPtoAdd);
            if (numDPtoAdd <= 0) {
                break;
            }
            newArray();
        }
    }

    syncBuffer() {
        this.popFront();
        this.popBack();
        this.pushFront();
        this.pushBack();
    }

    draw(renderDomain: { min: number, max: number }) {
        const data = this.series.data;
        if (this.vertexArrays.length === 0 || data[0].x > renderDomain.max || data[data.length - 1].x < renderDomain.min)
            return;

        let offset = this.vertexArrays[0].validStart / POINT_PER_DATAPOINT - 1;
        const key = (d: DataPoint) => d.x
        const minIndex = domainSearch(data, 1, data.length, renderDomain.min, key) + offset;
        const maxIndex = domainSearch(data, minIndex, data.length - 1, renderDomain.max, key) + 1 + offset;
        const minArrayIndex = Math.floor(minIndex / BUFFER_DATA_POINT_CAPACITY);
        const maxArrayIndex = Math.ceil(maxIndex / BUFFER_DATA_POINT_CAPACITY);

        for (let i = minArrayIndex; i < maxArrayIndex; i++) {
            const arrOffset = i * BUFFER_DATA_POINT_CAPACITY
            offset += this.vertexArrays[i].draw({
                min: minIndex - arrOffset,
                max: maxIndex - arrOffset,
            });
        }
    }
}

export class LineChartRenderer {
    private program = new LineChartWebGLProgram(this.gl, this.options.debugWebGL);
    private arrays = new Map<TimeChartSeriesOptions, SeriesVertexArray>();
    private height = 0;
    private width = 0;
    private renderHeight = 0;
    private renderWidth = 0;

    constructor(
        private model: RenderModel,
        private gl: WebGL2RenderingContext | WebGLRenderingContext,
        private options: ResolvedCoreOptions,
    ) {
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

    syncViewport() {
        this.renderWidth = this.width - this.options.renderPaddingLeft - this.options.renderPaddingRight;
        this.renderHeight = this.height - this.options.renderPaddingTop - this.options.renderPaddingBottom;

        const scale = vec2.fromValues(this.renderWidth, this.renderHeight)
        vec2.divide(scale, [2., 2.], scale)
        this.gl.uniform2fv(this.program.locations.uProjectionScale, scale);
    }

    onResize(width: number, height: number) {
        this.height = height;
        this.width = width;
    }

    drawFrame() {
        this.syncBuffer();
        this.syncDomain();
        const gl = this.gl;
        for (const [ds, arr] of this.arrays) {
            if (!ds.visible) {
                continue;
            }
            const color = resolveColorRGBA(ds.color ?? this.options.color);
            gl.uniform4fv(this.program.locations.uColor, color);

            const lineWidth = ds.lineWidth ?? this.options.lineWidth;
            gl.uniform1f(this.program.locations.uLineWidth, lineWidth / 2);

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

    private ySvgToView(v: number) {
        return -v + this.renderHeight / 2 + this.options.renderPaddingTop;
    }

    private xSvgToView(v: number) {
        return v - this.renderWidth / 2 - this.options.renderPaddingLeft;
    }

    syncDomain() {
        this.syncViewport();
        const m = this.model;
        const gl = this.gl;

        const zero = [this.xSvgToView(m.xScale(0)), this.ySvgToView(m.yScale(0))];
        const one = [this.xSvgToView(m.xScale(1)), this.ySvgToView(m.yScale(1))];

        // Not using vec2 for precision
        const scaling = [one[0] - zero[0], one[1] - zero[1]]

        gl.uniform2fv(this.program.locations.uModelScale, scaling);
        gl.uniform2fv(this.program.locations.uModelTranslation, zero);
    }
}

export const lineChart: TimeChartPlugin<LineChartRenderer> = {
    apply(chart) {
        return new LineChartRenderer(chart.model, chart.canvasLayer.gl, chart.options);
    }
}
