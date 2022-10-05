import { DataPoint, RenderModel } from "../core/renderModel";
import { resolveColorRGBA, ResolvedCoreOptions, TimeChartSeriesOptions } from '../options';
import { domainSearch } from '../utils';
import { vec2 } from 'gl-matrix';
import { TimeChartPlugin } from '.';
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { DataPointsBuffer } from "../core/dataPointsBuffer";


function vsSource(gl: WebGL2RenderingContext) {
    return `#version 300 es
uniform highp sampler2D uDataPoints;
uniform vec2 uModelScale;
uniform vec2 uModelTranslation;
uniform vec2 uProjectionScale;
uniform float uLineWidth;

const int TEX_WIDTH = ${BUFFER_TEXTURE_WIDTH};
const int TEX_HEIGHT = ${BUFFER_TEXTURE_HEIGHT};

vec2 dataPoint(int index) {
    int x = index % TEX_WIDTH;
    int y = index / TEX_WIDTH;
    return texelFetch(uDataPoints, ivec2(x, y), 0).xy;
}

void main() {
    int side = gl_VertexID & 1;
    int di = (gl_VertexID >> 1) & 1;
    int index = gl_VertexID >> 2;

    vec2 dp[2] = vec2[2](dataPoint(index), dataPoint(index + 1));
    vec2 dir = dp[1] - dp[0];
    if (side == 1)
        dir *= -1.;

    vec2 cssPose = uModelScale * (dp[di] + uModelTranslation);
    dir = normalize(uModelScale * dir);
    vec2 pos2d = uProjectionScale * (cssPose + vec2(-dir.y, dir.x) * uLineWidth);
    gl_Position = vec4(pos2d, 0, 1);
}`;
}

function fsSource(gl: WebGL2RenderingContext) {
    return `#version 300 es
precision lowp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
    outColor = uColor;
}
`;
}

class LineChartWebGLProgram extends LinkedWebGLProgram {
    locations;
    constructor(gl: WebGL2RenderingContext, debug: boolean) {
        super(gl, vsSource(gl), fsSource(gl), debug);
        this.link();

        const getLoc = (name: string) => throwIfFalsy(gl.getUniformLocation(this.program, name));

        this.locations = {
            uDataPoints: getLoc('uDataPoints'),
            uModelScale: getLoc('uModelScale'),
            uModelTranslation: getLoc('uModelTranslation'),
            uProjectionScale: getLoc('uProjectionScale'),
            uLineWidth: getLoc('uLineWidth'),
            uColor: getLoc('uColor'),
        }

        this.use();
        gl.uniform1i(this.locations.uDataPoints, 0);
    }
}

const BUFFER_TEXTURE_WIDTH = 256;
const BUFFER_TEXTURE_HEIGHT = 2048;
const BUFFER_POINT_CAPACITY = BUFFER_TEXTURE_WIDTH * BUFFER_TEXTURE_HEIGHT;
const BUFFER_INTERVAL_CAPACITY = BUFFER_POINT_CAPACITY - 2;

class SeriesSegmentVertexArray {
    dataBuffer;

    constructor(
        private gl: WebGL2RenderingContext,
        private dataPoints: DataPointsBuffer,
    ) {
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

    syncPoints(start: number, n: number, bufferPos: number) {
        const dps = this.dataPoints;
        let rowStart = Math.floor(bufferPos / BUFFER_TEXTURE_WIDTH);
        let rowEnd = Math.ceil(bufferPos + n / BUFFER_TEXTURE_WIDTH);
        if (start + n == dps.length && bufferPos + n == rowEnd * BUFFER_TEXTURE_WIDTH)
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
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.dataBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, first * 4, count * 4 + 2);
        return count;
    }
}

/**
 * An array of `SeriesSegmentVertexArray` to represent a series
 */
class SeriesVertexArray {
    private vertexArrays = [] as SeriesSegmentVertexArray[];
    private validStart = 0;
    private validEnd = 0;

    constructor(
        private gl: WebGL2RenderingContext,
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
            this.validEnd = 0;
        }

        if (this.vertexArrays.length === 0)
            newArray();
        activeArray = this.vertexArrays[this.vertexArrays.length - 1];

        while (true) {
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

        let offset = this.validStart - 1;
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
        private gl: WebGL2RenderingContext,
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
