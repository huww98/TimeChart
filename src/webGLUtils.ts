export class LinkedWebGLProgram {
    program: WebGLProgram;

    constructor(private gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string, debug: boolean) {
        const program = throwIfFalsy(gl.createProgram());
        gl.attachShader(program, throwIfFalsy(createShader(gl, gl.VERTEX_SHADER, vertexSource, debug)));
        gl.attachShader(program, throwIfFalsy(createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, debug)));
        gl.linkProgram(program);
        if (debug) {
            const success = gl.getProgramParameter(program, gl.LINK_STATUS);
            if (!success) {
                const message = gl.getProgramInfoLog(program) ?? 'Unknown Error.';
                gl.deleteProgram(program);
                throw new Error(message);
            }
        }

        this.program = program
    }

    public use() {
        this.gl.useProgram(this.program);
    }
}

export function createShader(gl: WebGLRenderingContext, type: number, source: string, debug: boolean): WebGLShader {
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
    return shader
}

export function throwIfFalsy<T>(value: T | undefined | null): T {
    if (!value) {
        throw new Error('value must not be falsy');
    }
    return value;
}
