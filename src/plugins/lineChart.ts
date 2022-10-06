import { DataPoint, RenderModel } from "../core/renderModel";
import { resolveColorRGBA, ResolvedCoreOptions, TimeChartSeriesOptions, LineType } from '../options';
import { domainSearch } from '../utils';
import { vec2 } from 'gl-matrix';
import { TimeChartPlugin } from '.';
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { DataPointsBuffer } from "../core/dataPointsBuffer";


const BUFFER_TEXTURE_WIDTH = 256;
const BUFFER_TEXTURE_HEIGHT = 2048;
const BUFFER_POINT_CAPACITY = BUFFER_TEXTURE_WIDTH * BUFFER_TEXTURE_HEIGHT;
const BUFFER_INTERVAL_CAPACITY = BUFFER_POINT_CAPACITY - 2;

class ShaderUniformData {
    data = new ArrayBuffer(3 * 2 * 4);
    ubo;

    constructor(private gl: WebGL2RenderingContext) {
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

class LineProgram extends LinkedWebGLProgram {
    static VS_SOURCE = `#version 300 es
layout (std140) uniform proj {
    vec2 modelScale;
    vec2 modelTranslate;
    vec2 projectionScale;
};
uniform highp sampler2D uDataPoints;
uniform float uLineWidth;
uniform int uLineType;
uniform float uStepLocation;

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

    static FS_SOURCE = `#version 300 es
precision lowp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
    outColor = uColor;
}`;

    locations;
    constructor(gl: WebGL2RenderingContext, debug: boolean) {
        super(gl, LineProgram.VS_SOURCE, LineProgram.FS_SOURCE, debug);
        this.link();

        const getLoc = (name: string) => throwIfFalsy(gl.getUniformLocation(this.program, name));

        this.locations = {
            uDataPoints: getLoc('uDataPoints'),
            uLineType: getLoc('uLineType'),
            uStepLocation: getLoc('uStepLocation'),
            uLineWidth: getLoc('uLineWidth'),
            uColor: getLoc('uColor'),
        }

        this.use();
        gl.uniform1i(this.locations.uDataPoints, 0);
        const projIdx = gl.getUniformBlockIndex(this.program, 'proj');
        gl.uniformBlockBinding(this.program, projIdx, 0);
    }
}

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

    syncPoints(start: number, n: number, bufferPos: number) {
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
    draw(renderInterval: { start: number, end: number }, type: LineType) {
        const first = Math.max(0, renderInterval.start);
        const last = Math.min(BUFFER_INTERVAL_CAPACITY, renderInterval.end)
        const count = last - first

        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.dataBuffer);
        if (type === LineType.Line) {
            gl.drawArrays(gl.TRIANGLE_STRIP, first * 4, count * 4 + (last !== renderInterval.end ? 2 : 0));
        } else if (type === LineType.Step) {
            let firstP = first * 4;
            let countP = count * 4 + 2;
            if (first === renderInterval.start) {
                firstP -= 2;
                countP += 2;
            }
            gl.drawArrays(gl.TRIANGLE_STRIP, firstP, countP);
        }
    }
}

/**
 * An array of `SeriesSegmentVertexArray` to represent a series
 */
class SeriesVertexArray {
    private segments = [] as SeriesSegmentVertexArray[];
    // each segment has at least 2 points
    private validStart = 0;  // start position of the first segment. (0, BUFFER_INTERVAL_CAPACITY]
    private validEnd = 0;    // end position of the last segment. [2, BUFFER_POINT_CAPACITY)

    constructor(
        private gl: WebGL2RenderingContext,
        private series: TimeChartSeriesOptions,
    ) {
    }

    private popFront() {
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
    private popBack() {
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

    private newArray() {
        return new SeriesSegmentVertexArray(this.gl, this.series.data);
    }
    private pushFront() {
        let numDPtoAdd = this.series.data.pushed_front;
        if (numDPtoAdd === 0)
            return;

        const newArray = () => {
            this.segments.unshift(this.newArray());
            this.validStart = BUFFER_POINT_CAPACITY;
        }

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

    private pushBack() {
        let numDPtoAdd = this.series.data.pushed_back;
        if (numDPtoAdd === 0)
            return

        const newArray = () => {
            this.segments.push(this.newArray());
            this.validEnd = 0;
        }

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
                } else {
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

    draw(renderDomain: { min: number, max: number }) {
        const data = this.series.data;
        if (this.segments.length === 0 || data[0].x > renderDomain.max || data[data.length - 1].x < renderDomain.min)
            return;

        const key = (d: DataPoint) => d.x
        const firstDP = domainSearch(data, 1, data.length, renderDomain.min, key) - 1;
        const lastDP = domainSearch(data, firstDP, data.length - 1, renderDomain.max, key)
        const startInterval = firstDP + this.validStart;
        const endInterval = lastDP + this.validStart;
        const startArray = Math.floor(startInterval / BUFFER_INTERVAL_CAPACITY);
        const endArray = Math.ceil(endInterval / BUFFER_INTERVAL_CAPACITY);

        for (let i = startArray; i < endArray; i++) {
            const arrOffset = i * BUFFER_INTERVAL_CAPACITY
            this.segments[i].draw({
                start: startInterval - arrOffset,
                end: endInterval - arrOffset,
            }, this.series.lineType);
        }
    }
}

export class LineChartRenderer {
    private program = new LineProgram(this.gl, this.options.debugWebGL);
    private uniformBuffer;
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
        this.uniformBuffer = new ShaderUniformData(this.gl);

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
        this.uniformBuffer.projectionScale.set(scale);
    }

    onResize(width: number, height: number) {
        this.height = height;
        this.width = width;
    }

    drawFrame() {
        this.syncBuffer();
        this.syncDomain();
        this.uniformBuffer.upload();
        const gl = this.gl;
        for (const [ds, arr] of this.arrays) {
            if (!ds.visible) {
                continue;
            }
            const color = resolveColorRGBA(ds.color ?? this.options.color);
            gl.uniform4fv(this.program.locations.uColor, color);

            gl.uniform1i(this.program.locations.uLineType, ds.lineType);
            const lineWidth = ds.lineWidth ?? this.options.lineWidth;
            gl.uniform1f(this.program.locations.uLineWidth, lineWidth / 2);
            if (ds.lineType === LineType.Step)
                gl.uniform1f(this.program.locations.uStepLocation, ds.stepLocation);

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

        this.uniformBuffer.modelScale.set(s);
        this.uniformBuffer.modelTranslate.set(t);
    }
}

export const lineChart: TimeChartPlugin<LineChartRenderer> = {
    apply(chart) {
        return new LineChartRenderer(chart.model, chart.canvasLayer.gl, chart.options);
    }
}
