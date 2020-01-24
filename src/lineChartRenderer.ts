import { vec2, vec3, mat4 } from 'gl-matrix';

import { RenderModel, DataPoint } from "./renderModel";
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { resolveColorRGBA, TimeChartSeriesOptions, ResolvedOptions } from './options';

const enum VertexAttribLocations {
    DATA_POINT = 0,
    NORM = 1,
}

const vsSource = `#version 300 es
layout (location = ${VertexAttribLocations.DATA_POINT}) in vec2 aDataPoint;
layout (location = ${VertexAttribLocations.NORM}) in vec2 aNorm;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uLineWidth;

void main() {
    vec4 cssPose = uModelViewMatrix * vec4(aDataPoint, 0.0, 1.0);
    gl_Position = uProjectionMatrix * (cssPose + vec4(aNorm * uLineWidth, 0.0, 0.0));
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

    constructor(private gl: WebGL2RenderingContext) {
        this.vao = throwIfFalsy(gl.createVertexArray());
        this.bind();

        this.dataBuffer = throwIfFalsy(gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, BUFFER_CAPACITY * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

        gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT);
        gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT, 2, gl.FLOAT, false, BYTES_PER_POINT, 0);

        gl.enableVertexAttribArray(VertexAttribLocations.NORM);
        gl.vertexAttribPointer(VertexAttribLocations.NORM, 2, gl.FLOAT, false, BYTES_PER_POINT, 2 * Float32Array.BYTES_PER_ELEMENT);
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
     * @param start At least 1, since datapoint 0 has no path to draw.
     * @returns Next data point index, or `dataPoints.length` if all data added.
     */
    addDataPoints(dataPoints: ArrayLike<DataPoint>, start: number): number {
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
        const dir = vec2.create();
        const norm1 = vec2.create();
        const norm2 = vec2.create();

        function calc(dp: DataPoint, previousDP: DataPoint) {
            vDP[0] = dp.x;
            vDP[1] = dp.y;
            vPreviousDP[0] = previousDP.x;
            vPreviousDP[1] = previousDP.y;
            vec2.subtract(dir, vDP, vPreviousDP);
            vec2.normalize(dir, dir);
            norm1[0] = -dir[1];
            norm1[1] = dir[0];
            vec2.negate(norm2, norm1);
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
                for (const norm of [norm1, norm2]) {
                    put(dp);
                    put(norm);
                }
            }
        }

        if (isOverflow) {
            calc(dataPoints[start + numDPtoAdd], previousDP);
            for (const norm of [norm1, norm2]) {
                put(vPreviousDP);
                put(norm);
            }
        }

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, BYTES_PER_POINT * POINT_PER_DATAPOINT * this.length, buffer);

        this.length += numDPtoAdd;
        return start + numDPtoAdd;
    }

    draw() {
        const gl = this.gl;
        this.bind();
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.length * POINT_PER_DATAPOINT);
    }
}

interface VertexArrayInfo {
    array: VertexArray;
    firstDataPointIndex: number;
}

class SeriesVertexArray {
    private vertexArrays = [] as VertexArrayInfo[];
    constructor(
        private gl: WebGL2RenderingContext,
        private series: TimeChartSeriesOptions,
    ) {
    }

    syncBuffer() {
        let activeArray: VertexArray;
        let bufferedDataPointNum = 1;

        const newArray = () => {
            activeArray = new VertexArray(this.gl);
            this.vertexArrays.push({
                array: activeArray,
                firstDataPointIndex: bufferedDataPointNum,
            });
        }

        if (this.vertexArrays.length > 0) {
            const lastVertexArray = this.vertexArrays[this.vertexArrays.length - 1];
            bufferedDataPointNum = lastVertexArray.firstDataPointIndex + lastVertexArray.array.length;
            if (bufferedDataPointNum > this.series.data.length) {
                throw new Error('remove data unsupported.');
            }
            if (bufferedDataPointNum === this.series.data.length) {
                return;
            }
            activeArray = lastVertexArray.array;
        } else if (this.series.data.length >= 2) {
            newArray();
            activeArray = activeArray!;
        } else {
            return; // Not enough data
        }

        while (true) {
            bufferedDataPointNum = activeArray.addDataPoints(this.series.data, bufferedDataPointNum);
            if (bufferedDataPointNum >= this.series.data.length) {
                if (bufferedDataPointNum > this.series.data.length) { throw Error('Assertion failed.'); }
                break;
            }
            newArray();
        }
    }

    draw() {
        for (const a of this.vertexArrays) {
            a.array.draw();
        }
    }
}

export class LineChartRenderer {
    private program = new LineChartWebGLProgram(this.gl)
    private arrays = new Map<TimeChartSeriesOptions, SeriesVertexArray>();
    private height = 0;

    constructor(
        private model: RenderModel,
        private gl: WebGL2RenderingContext,
        private options: ResolvedOptions,
    ) {
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
        this.height = height

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
            arr.draw();
        }
    }

    private ySvgToCanvas(v: number) {
        return -v + this.height;
    }

    syncDomain() {
        const m = this.model;
        const gl = this.gl;
        const baseTime = this.options.baseTime

        const zero = vec3.fromValues(m.xScale(baseTime), this.ySvgToCanvas(m.yScale(0)), 0);
        const one = vec3.fromValues(m.xScale(baseTime + 1), this.ySvgToCanvas(m.yScale(1)), 0);

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
