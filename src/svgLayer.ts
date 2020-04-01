export class SVGLayer {
    svgNode: SVGSVGElement;

    constructor(el: HTMLElement) {
        el.style.position = 'relative';
        this.svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgNode.style.position = 'absolute';
        this.svgNode.style.width = '100%';
        this.svgNode.style.height = '100%';
        el.appendChild(this.svgNode);
    }
}
