import { ResolvedRenderOptions } from './options';
import { RenderModel } from './renderModel';

export class ContentBoxDetector {
    static meta = {
        name: 'contentBoxDetector',
        required: ['wrapper', 'options'],
        optional: ['svgLayer', 'canvasLayer'],
    };
    node: HTMLElement;
    constructor(el: HTMLElement, model: RenderModel, options: ResolvedRenderOptions) {
        this.node = document.createElement('div');
        this.node.style.position = 'absolute';
        this.node.style.left = `${options.paddingLeft}px`;
        this.node.style.right = `${options.paddingRight}px`;
        this.node.style.top = `${options.paddingTop}px`;
        this.node.style.bottom = `${options.paddingBottom}px`;
        el.shadowRoot!.appendChild(this.node);

        model.disposing.on(() => {
            el.shadowRoot!.removeChild(this.node);
        })
    }
}
