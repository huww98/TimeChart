import { NearestPointModel } from "./nearestPoint";
import { ResolvedRenderOptions, TimeChartSeriesOptions } from "./options";
import { RenderModel } from './renderModel';

export class Tooltip {
    tooltip: HTMLElement;
    items = new Map<TimeChartSeriesOptions,
        { item: HTMLElement; example: HTMLElement; name: HTMLElement, value: HTMLElement }>();
    itemContainer: HTMLElement;

    static meta = {
        name: 'tooltip',
        required: ['svgLayer', 'model', 'options', 'contentBoxDetector'],
    }

    constructor(private el: HTMLElement, private model: RenderModel, private options: ResolvedRenderOptions,
        private nearestPoint: NearestPointModel) {
        const mouseOffset = 12;

        this.tooltip = document.createElement('chart-tooltip');

        const ls = this.tooltip.style;
        ls.position = 'absolute';
        ls.visibility = "hidden"

        const legendRoot = this.tooltip.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
:host {
    background: var(--background-overlay, white);
    border: 1px solid hsl(0, 0%, 80%);
    border-radius: 3px;
    padding: 2px 2px;
}
.item {
    user-select: none;
}
td {
    padding: 0px 5px;
}
.name {
    margin-right: 10px;
    max-width: 100px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}
.example {
    width: 6px;
    height: 6px;
}
.value {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    min-width: 100px;
    max-width: 100px;
    text-align: right;
}
`;
        legendRoot.appendChild(style);


        const table = document.createElement("table");
        legendRoot.appendChild(table);

        this.itemContainer = table;
        this.update();
        el.shadowRoot!.appendChild(this.tooltip);

        model.updated.on(() => this.update());

        model.disposing.on(() => {
            el.shadowRoot!.removeChild(this.tooltip);
        })

        el.addEventListener('mousemove', ((ev: MouseEvent) => {
            const contentRect = el.getBoundingClientRect();
            const tooltipRect = this.tooltip.getBoundingClientRect();
            ls.right = `${contentRect.width - (ev.clientX - contentRect.x) + mouseOffset}px`
            ls.top = `${(ev.clientY - contentRect.y - tooltipRect.height - mouseOffset)}px`
        }).bind(this));

        el.addEventListener('mouseenter', ev => {
            if (options.tooltip)
                ls.visibility = 'visible'
        });

        el.addEventListener('mouseleave', ev => {
            ls.visibility = 'hidden'
        });

        nearestPoint.updated.on(() => {
            for (const s of this.options.series) {
                if (!s.visible)
                    continue;

                let point = nearestPoint.points.get(s);
                let item = this.items.get(s);
                if (item && point)
                    item.value.textContent = "" + point.y;
            }
        });
    }

    update() {
        for (const s of this.options.series) {
            if (!this.items.has(s)) {
                const item = document.createElement('tr');
                item.className = 'item';
                const exampleTd = document.createElement('td');
                const example = document.createElement('div');
                example.className = 'example';
                exampleTd.appendChild(example)
                item.appendChild(exampleTd);
                const name = document.createElement('td');
                name.className = "name";
                name.textContent = s.name;
                item.appendChild(name);
                const value = document.createElement('td');
                value.className = "value";
                item.appendChild(value);

                this.itemContainer.appendChild(item);
                this.items.set(s, { item, example, name, value });
            }

            const item = this.items.get(s)!;
            item.example.style.backgroundColor = s.color.toString();
            item.item.style.display = s.visible ? "" : "none";
        }
    }
}
