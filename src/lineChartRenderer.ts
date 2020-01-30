import { vec2, vec3, mat4 } from 'gl-matrix';

import { RenderModel, DataPoint } from "./renderModel";
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { domainSearch } from './utils';
import { resolveColorRGBA, TimeChartSeriesOptions, ResolvedOptions } from './options';

const enum VertexAttribLocations {
    DATA_POINT = 0,
    DIR = 1,
}

const vsSource = `#version 300 es
layout (location = ${VertexAttribLocations.DATA_POINT}) in vec2 aDataPoint;
layout (location = ${VertexAttribLocations.DIR}) in vec2 aDir;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uLineWidth;

void main() {
    vec4 cssPose = uModelViewMatrix * vec4(aDataPoint, 0.0, 1.0);
    vec4 dir = uModelViewMatrix * vec4(aDir, 0.0, 0.0);
    dir = normalize(dir);
    gl_Position = uProjectionMatrix * (cssPose + vec4(-dir.y, dir.x, 0.0, 0.0) * uLineWidth);
}
`;

const fsSource = `#version 300 es
precision lowp float;

uniform vec4 uColor;

out vec4 outColor;

void main() {
    outColor = uColor;
}
`;

class LineChartWebGLProgram extends LinkedWebGLProgram {
    locations: {
        uModelViewMatrix: WebGLUniformLocation;
        uProjectionMatrix: WebGLUniformLocation;
        uLineWidth: WebGLUniformLocation;
        uColor: WebGLUniformLocation;
    };
    constructor(gl: WebGLRenderingContext) {
        super(gl, vsSource, fsSource);
        this.locations = {
            uModelViewMatrix: throwIfFalsy(gl.getUniformLocation(this.program, 'uModelViewMatrix')),
            uProjectionMatrix: throwIfFalsy(gl.getUniformLocation(this.program, 'uProjectionMatrix')),
            uLineWidth: throwIfFalsy(gl.getUniformLocation(this.program, 'uLineWidth')),
            uColor: throwIfFalsy(gl.getUniformLocation(this.program, 'uColor')),
        }
    }
}

const INDEX_PER_POINT = 4;
const POINT_PER_DATAPOINT = 4;
const INDEX_PER_DATAPOINT = INDEX_PER_POINT * POINT_PER_DATAPOINT;
const BYTES_PER_POINT = INDEX_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
const BUFFER_DATA_POINT_CAPACITY = 128 * 1024;
const BUFFER_CAPACITY = BUFFER_DATA_POINT_CAPACITY * INDEX_PER_DATAPOINT + 2 * POINT_PER_DATAPOINT;

class VertexArray {
    vao: WebGLVertexArrayObject;
    dataBuffer: WebGLBuffer;
    length = 0;

    /**
     * @param firstDataPointIndex At least 1, since datapoint 0 has no path to draw.
     */
    constructor(
        private gl: WebGL2RenderingContext,
        private dataPoints: ArrayLike<DataPoint>,
        public readonly firstDataPointIndex: number,
    ) {
        this.vao = throwIfFalsy(gl.createVertexArray());
        this.bind();

        this.dataBuffer = throwIfFalsy(gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, BUFFER_CAPACITY * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

        gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT);
        gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT, 2, gl.FLOAT, false, BYTES_PER_POINT, 0);

        gl.enableVertexAttribArray(VertexAttribLocations.DIR);
        gl.vertexAttribPointer(VertexAttribLocations.DIR, 2, gl.FLOAT, false, BYTES_PER_POINT, 2 * Float32Array.BYTES_PER_ELEMENT);
    }

    bind() {
        this.gl.bindVertexArray(this.vao);
    }

    clear() {
        this.length = 0;
    }

    delete() {
        this.clear();
        this.gl.deleteBuffer(this.dataBuffer);
        this.gl.deleteVertexArray(this.vao);
    }

    /**
     * @returns Next data point index, or `dataPoints.length` if all data added.
     */
    addDataPoints(): number {
        const dataPoints = this.dataPoints;
        const start = this.firstDataPointIndex + this.length;

        const remainDPCapacity = BUFFER_DATA_POINT_CAPACITY - this.length;
        const remainDPCount = dataPoints.length - start
        const isOverflow = remainDPCapacity < remainDPCount;
        const numDPtoAdd = isOverflow ? remainDPCapacity : remainDPCount;
        let extraBufferLength = INDEX_PER_DATAPOINT * numDPtoAdd;
        if (isOverflow) {
            extraBufferLength += 2 * INDEX_PER_POINT;
        }

        const buffer = new Float32Array(extraBufferLength);
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

    draw(renderIndex: { min: number, max: number }) {
        const first = Math.max(0, renderIndex.min - this.firstDataPointIndex);
        const last = Math.min(this.length, renderIndex.max - this.firstDataPointIndex)
        const count = last - first;

        const gl = this.gl;
        this.bind();
        gl.drawArrays(gl.TRIANGLE_STRIP, first * POINT_PER_DATAPOINT, count * POINT_PER_DATAPOINT);
    }
}

/**
 * An array of `VertexArray` to represent a series
 *
 * `series.data`  index: 0  [1 ... C] [C+1 ... 2C] ... (C = `BUFFER_DATA_POINT_CAPACITY`)
 * `vertexArrays` index:     0         1           ...
 */
class SeriesVertexArray {
    private vertexArrays = [] as VertexArray[];
    constructor(
        private gl: WebGL2RenderingContext,
        private series: TimeChartSeriesOptions,
    ) {
    }

    syncBuffer() {
        let activeArray: VertexArray;
        let bufferedDataPointNum = 1;

        const newArray = () => {
            activeArray = new VertexArray(this.gl, this.series.data , bufferedDataPointNum);
            this.vertexArrays.push(activeArray);
        }

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
        } else if (this.series.data.length >= 2) {
            newArray();
            activeArray = activeArray!;
        } else {
            return; // Not enough data
        }

        while (true) {
            bufferedDataPointNum = activeArray.addDataPoints();
            if (bufferedDataPointNum >= this.series.data.length) {
                if (bufferedDataPointNum > this.series.data.length) { throw Error('Assertion failed.'); }
                break;
            }
            newArray();
        }
    }

    draw(renderDomain: { min: number, max: number }) {
        const data = this.series.data;
        if (data.length === 0 || data[0].x > renderDomain.max || data[data.length - 1].x < renderDomain.min) {
            return;
        }

        const key = (d: DataPoint) => d.x
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
    private program = new LineChartWebGLProgram(this.gl)
    private arrays = new Map<TimeChartSeriesOptions, SeriesVertexArray>();
    private height = 0;
    private width = 0;

    constructor(
        private model: RenderModel,
        private gl: WebGL2RenderingContext,
        private options: ResolvedOptions,
    ) {
        model.onUpdate(() => this.drawFrame());
        this.program.use();
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

    onResize(width: number, height: number) {
        this.height = height;
        this.width = width;

        const scale = vec2.fromValues(width, height)
        vec2.divide(scale, scale, [2, 2])
        vec2.inverse(scale, scale)

        const translate = mat4.create();
        mat4.fromTranslation(translate, [-1.0, -1.0, 0.0])

        const projectionMatrix = mat4.create();
        mat4.fromScaling(projectionMatrix, [...scale, 1.0]);
        mat4.multiply(projectionMatrix, translate, projectionMatrix)

        const gl = this.gl;
        gl.uniformMatrix4fv(
            this.program.locations.uProjectionMatrix,
            false,
            projectionMatrix);
    }

    drawFrame() {
        this.syncBuffer();
        this.syncDomain();
        const gl = this.gl;
        for (const [ds, arr] of this.arrays) {
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
    }

    private ySvgToCanvas(v: number) {
        return -v + this.height;
    }

    syncDomain() {
        const m = this.model;
        const gl = this.gl;

        const zero = [m.xScale(0), this.ySvgToCanvas(m.yScale(0)), 0];
        const one = [m.xScale(1), this.ySvgToCanvas(m.yScale(1)), 0];

        const modelViewMatrix = mat4.create();

        const scaling = vec3.create();
        vec3.subtract(scaling, one, zero);
        mat4.fromScaling(modelViewMatrix, scaling);

        const translateMat = mat4.create()
        mat4.fromTranslation(translateMat, zero);

        mat4.multiply(modelViewMatrix, translateMat, modelViewMatrix);

        gl.uniformMatrix4fv(
            this.program.locations.uModelViewMatrix,
            false,
            modelViewMatrix);
    }
}
