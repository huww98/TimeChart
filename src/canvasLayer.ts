import { resolveColorRGBA, ResolvedRenderOptions } from './options';
import { RenderModel } from './renderModel';

export class CanvasLayer {
    canvas: HTMLCanvasElement
    gl: WebGL2RenderingContext;

    constructor(el: HTMLElement, private options: ResolvedRenderOptions, model: RenderModel) {
        el.style.position = 'relative';
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        el.appendChild(canvas);

        const ctx = canvas.getContext('webgl2');
        if (!ctx) {
            throw new Error('Unable to initialize WebGL. Your browser or machine may not support it.');
        }
        const gl = ctx;
        this.gl = gl;

        const bgColor = resolveColorRGBA(options.backgroundColor);
        gl.clearColor(...bgColor);

        this.canvas = canvas;

        model.updated.on(() => this.clear());
        model.resized.on((w, h) => this.onResize(w, h));
    }

    onResize(width: number, height: number) {
        const canvas = this.canvas;
        const scale = this.options.pixelRatio;
        canvas.width = width * scale;
        canvas.height = height * scale;
        this.gl.viewport(0, 0, canvas.width, canvas.height);
    }

    clear() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
