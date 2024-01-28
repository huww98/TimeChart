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
        var _a;
        const gl = this.gl;
        const program = this.program;
        gl.linkProgram(program);
        if (this.debug) {
            const success = gl.getProgramParameter(program, gl.LINK_STATUS);
            if (!success) {
                const message = (_a = gl.getProgramInfoLog(program)) !== null && _a !== void 0 ? _a : 'Unknown Error.';
                gl.deleteProgram(program);
                throw new Error(message);
            }
        }
    }
    getUniformLocation(name) {
        return throwIfFalsy(this.gl.getUniformLocation(this.program, name));
    }
    use() {
        this.gl.useProgram(this.program);
    }
}
export function createShader(gl, type, source, debug) {
    var _a;
    const shader = throwIfFalsy(gl.createShader(type));
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (debug) {
        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            const message = (_a = gl.getShaderInfoLog(shader)) !== null && _a !== void 0 ? _a : 'Unknown Error.';
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