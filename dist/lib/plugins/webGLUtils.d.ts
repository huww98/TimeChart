export declare class LinkedWebGLProgram {
    private gl;
    readonly debug: boolean;
    program: WebGLProgram;
    constructor(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string, debug: boolean);
    link(): void;
    getUniformLocation(name: string): WebGLUniformLocation;
    use(): void;
}
export declare function createShader(gl: WebGLRenderingContext, type: number, source: string, debug: boolean): WebGLShader;
export declare function throwIfFalsy<T>(value: T | undefined | null): T;
