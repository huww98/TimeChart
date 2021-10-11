import { NearestPointModel } from "../core/nearestPoint";
import { ResolvedCoreOptions, TimeChartSeriesOptions } from "../options";
import { RenderModel } from "../core/renderModel";
import { TimeChartPlugin } from ".";

type ItemElements = { item: HTMLElement; example: HTMLElement; name: HTMLElement, value: HTMLElement }

export class Tooltip {
    tooltip: HTMLElement;

    xItem = {} as ItemElements;
    items = new Map<TimeChartSeriesOptions, ItemElements>();
    itemContainer: HTMLElement;

    constructor(private el: HTMLElement, private model: RenderModel, private options: ResolvedCoreOptions,
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
            let right = contentRect.width - (ev.clientX - contentRect.x) + mouseOffset;
            let top = (ev.clientY - contentRect.y - tooltipRect.height - mouseOffset);

            if (right + tooltipRect.width + mouseOffset > (contentRect.width))
                right = right - tooltipRect.width - mouseOffset*2;

            if (top < 0)
                top = top + tooltipRect.height + mouseOffset*2;

            ls.right = right + "px";
            ls.top = top + "px";
        }).bind(this));

        el.addEventListener('mouseenter', ev => {
            if (options.tooltip)
                ls.visibility = 'visible'
        });

        el.addEventListener('mouseleave', ev => {
            ls.visibility = 'hidden'
        });

        nearestPoint.updated.on(() => {
            this.xItem.value.textContent = ""
            for (const s of this.options.series) {
                if (!s.visible)
                    continue;

                let point = nearestPoint.dataPoints.get(s);
                let item = this.items.get(s);
                if(point) {
                    if (item)
                        item.value.textContent = point.y.toLocaleString();

                    if(!isNaN(point.x))
                        this.xItem.value.textContent = point.x.toLocaleString();
                }
            }
        });
    }

    private createItemElements(label: string): ItemElements {
        const item = document.createElement('tr');
        item.className = 'item';
        const exampleTd = document.createElement('td');
        const example = document.createElement('div');
        example.className = 'example';
        exampleTd.appendChild(example)
        item.appendChild(exampleTd);
        const name = document.createElement('td');
        name.className = "name";
        name.textContent = label;
        item.appendChild(name);
        const value = document.createElement('td');
        value.className = "value";
        item.appendChild(value);

        return { item, example, name, value };
    }

    update() {
        if(!this.xItem.item && this.options.series.length != 0) {
            const itemElements = this.createItemElements(this.options.tooltipXLabel);
            this.itemContainer.appendChild(itemElements.item);
            this.xItem = itemElements
        }

        for (const s of this.options.series) {
            if (!this.items.has(s)) {
                const itemElements = this.createItemElements(s.name);
                this.itemContainer.appendChild(itemElements.item);
                this.items.set(s, itemElements);
            }

            const item = this.items.get(s)!;
            item.example.style.backgroundColor = s.color.toString();
            item.item.style.display = s.visible ? "" : "none";
        }
    }
}

export const tooltip: TimeChartPlugin<Tooltip> = {
    apply(chart) {
        return new Tooltip(chart.el, chart.model, chart.options, chart.nearestPoint);
    }
}