import { resolveColorRGBA, ResolvedRenderOptions } from './options';
import { RenderModel } from './renderModel';

export class CanvasLayer {
    canvas: HTMLCanvasElement
    gl: WebGL2RenderingContext;

    constructor(el: HTMLElement, options: ResolvedRenderOptions, model: RenderModel) {
        model.updated.on(() => this.clear());

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
    }

    onResize() {
        const canvas = this.canvas;
        const scale = window.devicePixelRatio;
        canvas.width = canvas.clientWidth * scale;
        canvas.height = canvas.clientHeight * scale;
        this.gl.viewport(0, 0, canvas.width, canvas.height);
    }

    clear() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
