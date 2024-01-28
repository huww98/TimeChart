const defaultOptions = {
    mouseButtons: 1,
    enableX: true,
    enableY: true,
    cancelOnSecondPointer: false,
};
;
export class SelectZoom {
    constructor(chart, options) {
        this.chart = chart;
        this.options = options;
        this.start = null;
        const el = chart.contentBoxDetector.node;
        el.tabIndex = -1;
        el.addEventListener('pointerdown', ev => this.onMouseDown(ev), { signal: chart.model.abortController.signal });
        el.addEventListener('pointerup', ev => this.onMouseUp(ev), { signal: chart.model.abortController.signal });
        el.addEventListener('pointermove', ev => this.onMouseMove(ev), { signal: chart.model.abortController.signal });
        el.addEventListener('pointercancel', ev => this.onPointerCancel(ev), { signal: chart.model.abortController.signal });
        el.addEventListener('keydown', ev => this.onKeyDown(ev), { signal: chart.model.abortController.signal });
        const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
        style.textContent = `
.timechart-selection {
    stroke: currentColor;
    stroke-width: 1;
    fill: gray;
    opacity: 0.5;
    visibility: hidden;
}`;
        chart.svgLayer.svgNode.appendChild(style);
        this.visual = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.visual.classList.add('timechart-selection');
        chart.svgLayer.svgNode.appendChild(this.visual);
    }
    onKeyDown(ev) {
        if (ev.code === 'Escape')
            this.reset();
    }
    reset() {
        if (this.start === null)
            return;
        const el = this.chart.contentBoxDetector.node;
        el.releasePointerCapture(this.start.id);
        this.visual.style.visibility = 'hidden';
        this.start = null;
    }
    getPoint(ev) {
        const boundingRect = this.chart.svgLayer.svgNode.getBoundingClientRect();
        return {
            x: ev.clientX - boundingRect.left,
            y: ev.clientY - boundingRect.top,
        };
    }
    onMouseDown(ev) {
        if (this.start !== null) {
            if (this.options.cancelOnSecondPointer)
                this.reset();
            return;
        }
        if (ev.pointerType === 'mouse' && (ev.buttons & this.options.mouseButtons) === 0)
            return;
        const el = this.chart.contentBoxDetector.node;
        this.start = {
            p: this.getPoint(ev),
            id: ev.pointerId,
        };
        el.setPointerCapture(ev.pointerId);
        this.visual.x.baseVal.value = this.start.p.x;
        this.visual.y.baseVal.value = this.start.p.y;
        this.visual.width.baseVal.value = 0;
        this.visual.height.baseVal.value = 0;
        this.visual.style.visibility = 'visible';
    }
    onMouseMove(ev) {
        var _a;
        if (ev.pointerId !== ((_a = this.start) === null || _a === void 0 ? void 0 : _a.id))
            return;
        const p = this.getPoint(ev);
        if (this.options.enableX) {
            const x = Math.min(this.start.p.x, p.x);
            const w = Math.abs(this.start.p.x - p.x);
            this.visual.x.baseVal.value = x;
            this.visual.width.baseVal.value = w;
        }
        else {
            this.visual.setAttribute('x', '0');
            this.visual.setAttribute('width', '100%');
        }
        if (this.options.enableY) {
            const y = Math.min(this.start.p.y, p.y);
            const h = Math.abs(this.start.p.y - p.y);
            this.visual.y.baseVal.value = y;
            this.visual.height.baseVal.value = h;
        }
        else {
            this.visual.setAttribute('y', '0');
            this.visual.setAttribute('height', '100%');
        }
    }
    onMouseUp(ev) {
        var _a;
        if (ev.pointerId !== ((_a = this.start) === null || _a === void 0 ? void 0 : _a.id))
            return;
        const p = this.getPoint(ev);
        let changed = false;
        if (this.options.enableX) {
            const x1 = Math.min(this.start.p.x, p.x);
            const x2 = Math.max(this.start.p.x, p.x);
            if (x2 - x1 > 0) {
                const newDomain = [
                    this.chart.model.xScale.invert(x1),
                    this.chart.model.xScale.invert(x2),
                ];
                this.chart.model.xScale.domain(newDomain);
                this.chart.options.xRange = null;
                changed = true;
            }
        }
        if (this.options.enableY) {
            const y1 = Math.max(this.start.p.y, p.y);
            const y2 = Math.min(this.start.p.y, p.y);
            if (y1 - y2 > 0) {
                const newDomain = [
                    this.chart.model.yScale.invert(y1),
                    this.chart.model.yScale.invert(y2),
                ];
                this.chart.model.yScale.domain(newDomain);
                this.chart.options.yRange = null;
                changed = true;
            }
        }
        if (changed)
            this.chart.model.requestRedraw();
        this.reset();
    }
    onPointerCancel(ev) {
        var _a;
        if (ev.pointerId === ((_a = this.start) === null || _a === void 0 ? void 0 : _a.id))
            this.reset();
    }
}
export class SelectZoomPlugin {
    constructor(options) {
        if (!options)
            options = {};
        if (!defaultOptions.isPrototypeOf(options))
            Object.setPrototypeOf(options, defaultOptions);
        this.options = options;
    }
    apply(chart) {
        return new SelectZoom(chart, this.options);
    }
}
//# sourceMappingURL=selectZoom.js.map