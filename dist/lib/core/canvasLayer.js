import { resolveColorRGBA } from '../options';
function getContext(canvas) {
    const ctx = canvas.getContext('webgl2');
    if (!ctx) {
        throw new Error('Unable to initialize WebGL2. Your browser or machine may not support it.');
    }
    return ctx;
}
export class CanvasLayer {
    constructor(el, options, model) {
        this.options = options;
        const canvas = document.createElement('canvas');
        const style = canvas.style;
        style.position = 'absolute';
        style.width = style.height = '100%';
        style.left = style.right = style.top = style.bottom = '0';
        el.shadowRoot.appendChild(canvas);
        this.gl = getContext(canvas);
        const bgColor = resolveColorRGBA(options.backgroundColor);
        this.gl.clearColor(...bgColor);
        this.canvas = canvas;
        model.updated.on(() => {
            this.clear();
            this.syncViewport();
        });
        model.resized.on((w, h) => this.onResize(w, h));
        model.disposing.on(() => {
            el.shadowRoot.removeChild(canvas);
            canvas.width = 0;
            canvas.height = 0;
            const lossContext = this.gl.getExtension('WEBGL_lose_context');
            if (lossContext) {
                lossContext.loseContext();
            }
        });
    }
    syncViewport() {
        const o = this.options;
        const r = o.pixelRatio;
        this.gl.viewport(o.renderPaddingLeft * r, o.renderPaddingBottom * r, (this.canvas.width - (o.renderPaddingLeft + o.renderPaddingRight) * r), (this.canvas.height - (o.renderPaddingTop + o.renderPaddingBottom) * r));
    }
    onResize(width, height) {
        const canvas = this.canvas;
        const scale = this.options.pixelRatio;
        canvas.width = width * scale;
        canvas.height = height * scale;
        this.syncViewport();
    }
    clear() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
//# sourceMappingURL=canvasLayer.js.map