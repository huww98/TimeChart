import { RenderModel } from "./renderModel";
import { LinkedWebGLProgram, throwIfFalsy } from './webGLUtils';
import { vec2, mat4 } from 'gl-matrix';

const enum VertexAttribLocations {
    NEXT_POINT = 0,
    SIDE = 1,
    NEXT_SIDE = 2,
    DATA_POINT_CURRENT = 3,
    DATA_POINT_NEXT_1 = 4,
    DATA_POINT_NEXT_2 = 5,
}

const vsSource = `#version 300 es
layout (location = ${VertexAttribLocations.NEXT_POINT}) in float aNextPoint;
layout (location = ${VertexAttribLocations.SIDE}) in float aSide;
layout (location = ${VertexAttribLocations.NEXT_SIDE}) in float aNextSide;
layout (location = ${VertexAttribLocations.DATA_POINT_CURRENT}) in vec2 aDataPointCurrent;
layout (location = ${VertexAttribLocations.DATA_POINT_NEXT_1}) in vec2 aDataPointNext1;
layout (location = ${VertexAttribLocations.DATA_POINT_NEXT_2}) in vec2 aDataPointNext2;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uLineWidth;

vec2 normDir(vec2 dir) {
    vec2 unitDir = normalize(dir);
    return vec2(-unitDir.y, unitDir.x);
}

void main() {
    vec2 dir = aDataPointNext1 - aDataPointCurrent;
    vec2 currentNorm = normDir(dir);
    vec2 nextNorm = normDir(aDataPointNext2 - aDataPointNext1);

    vec2 offset = uLineWidth * (aSide * currentNorm + aNextSide * nextNorm);
    vec2 base = aDataPointCurrent + aNextPoint * dir;
    vec4 cssPose = uModelViewMatrix * vec4(base, 0.0, 1.0);
    gl_Position = uProjectionMatrix * (cssPose + vec4(offset, 0.0, 0.0));
}
`;

const fsSource = `#version 300 es
precision lowp float;

out vec4 outColor;

void main() {
    outColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

class LineChartWebGLProgram extends LinkedWebGLProgram {
    locations: {
        uModelViewMatrix: WebGLUniformLocation;
        uProjectionMatrix: WebGLUniformLocation;
        uLineWidth: WebGLUniformLocation;
    };
    constructor(gl: WebGLRenderingContext) {
        super(gl, vsSource, fsSource);
        this.locations = {
            uModelViewMatrix: throwIfFalsy(gl.getUniformLocation(this.program, 'uModelViewMatrix')),
            uProjectionMatrix: throwIfFalsy(gl.getUniformLocation(this.program, 'uProjectionMatrix')),
            uLineWidth: throwIfFalsy(gl.getUniformLocation(this.program, 'uLineWidth')),
        }
    }
}

const INDEX_PER_POINT = 2
const BYTES_PER_POINT = INDEX_PER_POINT * Float32Array.BYTES_PER_ELEMENT

export class LineChartRenderer {
    private program = new LineChartWebGLProgram(this.gl)
    constructor(
        private model: RenderModel,
        private gl: WebGL2RenderingContext,
    ) {
        const posArray = new Float32Array([
            // aPointIndex, aSide, aNextSide,
            0, 1, 0,
            0, -1, 0,
            1, 1, 0,
            1, -1, 0,
            1, 0, 1,
            1, 0, -1,
        ]);
        const posArrayStride = 3 * Float32Array.BYTES_PER_ELEMENT
        // const vao = throwIfFalsy(gl.createVertexArray())
        // gl.bindVertexArray(vao)

        const posBuffer = throwIfFalsy(gl.createBuffer())
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, posArray, gl.STATIC_DRAW)

        gl.enableVertexAttribArray(VertexAttribLocations.NEXT_POINT)
        gl.vertexAttribPointer(VertexAttribLocations.NEXT_POINT, 1, gl.FLOAT, false, posArrayStride, 0)

        gl.enableVertexAttribArray(VertexAttribLocations.SIDE)
        gl.vertexAttribPointer(VertexAttribLocations.SIDE, 1, gl.FLOAT, false, posArrayStride, 1 * Float32Array.BYTES_PER_ELEMENT)

        gl.enableVertexAttribArray(VertexAttribLocations.NEXT_SIDE)
        gl.vertexAttribPointer(VertexAttribLocations.NEXT_SIDE, 1, gl.FLOAT, false, posArrayStride, 2 * Float32Array.BYTES_PER_ELEMENT)

        const dataBuffer = throwIfFalsy(gl.createBuffer());
        gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffer);

        gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT_CURRENT);
        gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT_CURRENT, 2, gl.FLOAT, false, BYTES_PER_POINT, 0);
        gl.vertexAttribDivisor(VertexAttribLocations.DATA_POINT_CURRENT, 1);

        gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT_NEXT_1);
        gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT_NEXT_1, 2, gl.FLOAT, false, BYTES_PER_POINT, 2 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(VertexAttribLocations.DATA_POINT_NEXT_1, 1);

        gl.enableVertexAttribArray(VertexAttribLocations.DATA_POINT_NEXT_2);
        gl.vertexAttribPointer(VertexAttribLocations.DATA_POINT_NEXT_2, 2, gl.FLOAT, false, BYTES_PER_POINT, 4 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(VertexAttribLocations.DATA_POINT_NEXT_2, 1);

        const dataArray = new Float32Array(model.dataPoints.length * INDEX_PER_POINT);
        for (let i = 0; i < model.dataPoints.length; i++) {
            const ai = i * INDEX_PER_POINT;
            const data = model.dataPoints[i];
            dataArray[ai] = data.x;
            dataArray[ai + 1] = data.y;
        }

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const scale = vec2.fromValues(960.0, 640.0)
        vec2.divide(scale, scale, [2, 2])
        vec2.inverse(scale, scale)

        const translate = mat4.create();
        mat4.fromTranslation(translate, [-1.0, -1.0, 0.0])

        const projectionMatrix = mat4.create();
        mat4.fromScaling(projectionMatrix, [...scale, 1.0]);
        mat4.multiply(projectionMatrix, translate, projectionMatrix)

        const modelViewMatrix = mat4.create();

        this.program.use();
        gl.uniformMatrix4fv(
            this.program.locations.uProjectionMatrix,
            false,
            projectionMatrix);
        gl.uniformMatrix4fv(
            this.program.locations.uModelViewMatrix,
            false,
            modelViewMatrix);
        gl.uniform1f(
            this.program.locations.uLineWidth,
            0.5,
        )

        gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, dataArray, gl.STATIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 6, model.dataPoints.length - 2);

        // Last segment
        gl.bufferData(gl.ARRAY_BUFFER, dataArray.slice(dataArray.length - 4), gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
