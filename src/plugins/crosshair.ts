import { makeContentBox } from '../core/svgLayer';
import { TimeChartPlugin } from '.';

export const crosshair: TimeChartPlugin<void> = {
    apply(chart) {
        const contentBox = makeContentBox(chart.model, chart.options);
        const initTrans = contentBox.createSVGTransform();
        initTrans.setTranslate(0, 0);

        const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
        style.textContent = `
.timechart-crosshair {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 2 1;
    visibility: hidden;
}`;
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.transform.baseVal.initialize(initTrans);
        hLine.x2.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.transform.baseVal.initialize(initTrans);
        vLine.y2.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PERCENTAGE, 100);

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('timechart-crosshair');
        for (const e of [style, hLine, vLine]) {
            g.appendChild(e);
        }

        const detector = chart.contentBoxDetector;
        detector.node.addEventListener('mousemove', ev => {
            const contentRect = contentBox.getBoundingClientRect();
            hLine.transform.baseVal.getItem(0).setTranslate(0, ev.clientY - contentRect.y);
            vLine.transform.baseVal.getItem(0).setTranslate(ev.clientX - contentRect.x, 0);
        });
        detector.node.addEventListener('mouseenter', ev => g.style.visibility = 'visible');
        detector.node.addEventListener('mouseleave', ev => g.style.visibility = 'hidden');

        contentBox.appendChild(g);
        chart.svgLayer.svgNode.appendChild(contentBox);
    }
}
