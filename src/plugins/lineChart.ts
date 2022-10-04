import { DataPoint, RenderModel } from "../core/renderModel";
import { resolveColorRGBA, ResolvedCoreOptions, TimeChartSeriesOptions } from '../options';
import { domainSearch } from '../utils';
import { vec2 } from 'gl-matrix';
import { TimeChartPlugin } from '.';
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { DataPointsBuffer } from "../core/dataPointsBuffer";


const enum VertexAttribLocations {
    FLAGS = 0,
    DATA_POINT0 = 1,
    DATA_POINT1 = 2,
    DATA_POINT2 = 3,
}

function vsSource(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const body = `
uniform vec2 uModelScale;
uniform vec2 uModelTranslation;
uniform vec2 uProjectionScale;
uniform float uLineWidth;

void main() {
# if defined(WEBGL1)
    int flags = int(aFlags);
# else
    int flags = aFlags;
# endif
    int side = flags & 1;
    int i = (flags >> 1) & 1;
    int di = (flags >> 2) & 1;

    vec2 dp[3] = vec2[3](aDataPoint0, aDataPoint1, aDataPoint2);
    vec2 dir = dp[di + 1] - dp[di];
    if (side == 1)
        dir *= -1.;

    vec2 cssPose = uModelScale * (dp[i] + uModelTranslation);
    dir = normalize(uModelScale * dir);
    vec2 pos2d = uProjectionScale * (cssPose + vec2(-dir.y, dir.x) * uLineWidth);
    gl_Position = vec4(pos2d, 0, 1);
}`;

    if (gl instanceof WebGL2RenderingContext) {
        return `#version 300 es
layout (location = ${VertexAttribLocations.FLAGS}) in lowp int aFlags;
layout (location = ${VertexAttribLocations.DATA_POINT0}) in highp vec2 aDataPoint0;
layout (location = ${VertexAttribLocations.DATA_POINT1}) in highp vec2 aDataPoint1;
layout (location = ${VertexAttribLocations.DATA_POINT2}) in highp vec2 aDataPoint2;
${body}`;
    } else {
        return `
# define WEBGL1
attribute lowp float aFlags;
attribute highp vec2 aDataPoints0;
attribute highp vec2 aDataPoints1;
attribute highp vec2 aDataPoints2;
${body}`;
    }
}

function fsSource(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const body = `
`;
    if (gl instanceof WebGL2RenderingContext) {
        return `#version 300 es
precision lowp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
    outColor = uColor;
}`;
    } else {
        return `
precision lowp float;
uniform vec4 uColor;
void main() {
    gl_FragColor = uColor;
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
            gl.bindAttribLocation(this.program, VertexAttribLocations.FLAGS, 'aFlags');
            gl.bindAttribLocation(this.program, VertexAttribLocations.DATA_POINT0, 'aDataPoint0');
            gl.bindAttribLocation(this.program, VertexAttribLocations.DATA_POINT1, 'aDataPoint1');
            gl.bindAttribLocation(this.program, VertexAttribLocations.DATA_POINT2, 'aDataPoint2');
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

const INDEX_PER_DATAPOINT = 2;
const BYTES_PER_DATAPOINT = INDEX_PER_DATAPOINT * Float32Array.BYTES_PER_ELEMENT;
const BUFFER_INTERVAL_CAPACITY = 512 * 1024;
const BUFFER_POINT_CAPACITY = BUFFER_INTERVAL_CAPACITY + 2;
const BUFFER_CAPACITY = BUFFER_POINT_CAPACITY * INDEX_PER_DATAPOINT;

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
    lastDrawStart = -1;

    constructor(
        private gl: WebGL2RenderingContext | WebGLRenderingContext,
        private dataPoints: DataPointsBuffer,
        globalInit: () => void,
    ) {
        this.dataBuffer = throwIfFalsy(gl.createBuffer());
        const bindFunc = () => {
            globalInit();

            gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);

            gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT0);
            gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT1);
            gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT2);
            if (gl instanceof WebGL2RenderingContext) {
                gl.vertexAttribDivisor(VertexAttribLocations.DATA_POINT0, 1);
                gl.vertexAttribDivisor(VertexAttribLocations.DATA_POINT1, 1);
                gl.vertexAttribDivisor(VertexAttribLocations.DATA_POINT2, 1);
            } else {
                const ext = gl.getExtension('ANGLE_instanced_arrays');
                if (!ext) {
                    throw new Error('ANGLE_instanced_arrays not supported');
                }
                ext.vertexAttribDivisorANGLE(VertexAttribLocations.DATA_POINT0, 1);
                ext.vertexAttribDivisorANGLE(VertexAttribLocations.DATA_POINT1, 1);
                ext.vertexAttribDivisorANGLE(VertexAttribLocations.DATA_POINT2, 1);
            }
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

    private syncPoints(start: number, n: number, bufferPos: number) {
        const dps = this.dataPoints;
        const posVaild = (pos: number) => pos >= this.validStart && pos < this.validEnd;
        const repeatTail = bufferPos + n < BUFFER_POINT_CAPACITY && !posVaild(bufferPos + n)
        let nUpload = n + (repeatTail ? 1 : 0);

        const buffer = new Float32Array(nUpload * INDEX_PER_DATAPOINT);
        let bi = 0;

        function put(dp: DataPoint) {
            buffer[bi] = dp.x;
            buffer[bi + 1] = dp.y;
            bi += 2;
        }

        for (let i = 0; i < n; i++)
            put(dps[start + i]);
        if (repeatTail)
            put(dps[start + n - 1]);

        if (bi !== buffer.length)
            throw Error('BUG!')

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, BYTES_PER_DATAPOINT * bufferPos, buffer);

        this.validStart = Math.min(this.validStart, bufferPos);
        this.validEnd = Math.max(this.validEnd, bufferPos + n);
    }

    /**
     * @returns Number of datapoints remaining to be added to other segments.
     */
    pushBack(n: number): number {
        const numDPToAdd = Math.min(n, BUFFER_POINT_CAPACITY - this.validEnd);
        this.syncPoints(this.dataPoints.length - n, numDPToAdd, this.validEnd);
        return n - Math.max(0, BUFFER_INTERVAL_CAPACITY - (this.validEnd - numDPToAdd));
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

    /**
     * @param renderInterval [start, end) interval of data points, start from 0
     */
    draw(renderInterval: { start: number, end: number }) {
        const first = Math.max(0, renderInterval.start);
        const last = Math.min(BUFFER_INTERVAL_CAPACITY, renderInterval.end)
        const count = last - first

        const gl = this.gl;
        this.vao.bind();

        if (this.lastDrawStart !== first) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
            for (let i = 0; i < 3; i++) {
                gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT0 + i, 2, gl.FLOAT, false, BYTES_PER_DATAPOINT, (first + i) * BYTES_PER_DATAPOINT);
            }
            this.lastDrawStart = first;
        }
        if (gl instanceof WebGL2RenderingContext) {
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 6, count);
        } else {
            const ext = gl.getExtension('ANGLE_instanced_arrays');
            ext!.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 6, count);
        }
        return count;
    }
}

/**
 * An array of `SeriesSegmentVertexArray` to represent a series
 */
class SeriesVertexArray {
    private vertexArrays = [] as SeriesSegmentVertexArray[];
    private readonly flagsBuffer: WebGLBuffer;
    constructor(
        private gl: WebGL2RenderingContext | WebGLRenderingContext,
        private series: TimeChartSeriesOptions,
    ) {
        this.flagsBuffer = throwIfFalsy(gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, this.flagsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Int8Array([0b000, 0b001, 0b010, 0b011, 0b110, 0b111]), gl.STATIC_DRAW);
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
        const globalInit = () => {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.flagsBuffer);
            gl.enableVertexAttribArray(VertexAttribLocations.FLAGS);
            if (gl instanceof WebGL2RenderingContext)
                gl.vertexAttribIPointer(VertexAttribLocations.FLAGS, 1, gl.BYTE, 1, 0);
            else
                gl.vertexAttribPointer(VertexAttribLocations.FLAGS, 1, gl.BYTE, false, 1, 0);
        };
        return new SeriesSegmentVertexArray(this.gl, this.series.data, globalInit);
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
            newArray();
            // The very first data point is not drawn
            if (numDPtoAdd < 2)
                return;
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

        if (this.vertexArrays.length === 0)
            newArray();
        activeArray = this.vertexArrays[this.vertexArrays.length - 1];

        while (true) {
            numDPtoAdd = activeArray.pushBack(numDPtoAdd);
            if (numDPtoAdd <= 0)
                break;
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

        let offset = this.vertexArrays[0].validStart - 1;
        const key = (d: DataPoint) => d.x
        const startInterval = domainSearch(data, 1, data.length, renderDomain.min, key) + offset;
        const endInterval = domainSearch(data, startInterval, data.length - 1, renderDomain.max, key) + 1 + offset;
        const startArray = Math.floor(startInterval / BUFFER_INTERVAL_CAPACITY);
        const endArray = Math.ceil(endInterval / BUFFER_INTERVAL_CAPACITY);

        for (let i = startArray; i < endArray; i++) {
            const arrOffset = i * BUFFER_INTERVAL_CAPACITY
            offset += this.vertexArrays[i].draw({
                start: startInterval - arrOffset,
                end: endInterval - arrOffset,
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

    syncDomain() {
        this.syncViewport();
        const m = this.model;
        const gl = this.gl;

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

        gl.uniform2fv(this.program.locations.uModelScale, s);
        gl.uniform2fv(this.program.locations.uModelTranslation, t);
    }
}

export const lineChart: TimeChartPlugin<LineChartRenderer> = {
    apply(chart) {
        return new LineChartRenderer(chart.model, chart.canvasLayer.gl, chart.options);
    }
}
