export class LinkedWebGLProgram {
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
export function createShader(gl, type, source, debug) {
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
export function throwIfFalsy(value) {
    if (!value) {
        throw new Error('value must not be falsy');
    }
    return value;
}
//# sourceMappingURL=webGLUtils.js.map