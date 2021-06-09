import { RenderModel } from "@/core/renderModel";
import { ResolvedCoreOptions, TimeChartSeriesOptions } from "@/options";
import { TimeChartPlugin } from ".";

export class Legend {
    legend: HTMLElement;
    items = new Map<TimeChartSeriesOptions, { item: HTMLElement; example: HTMLElement; }>();
    itemContainer: Node;

    constructor(private el: HTMLElement, private model: RenderModel, private options: ResolvedCoreOptions) {
        this.legend = document.createElement('chart-legend');
        const ls = this.legend.style;
        ls.position = 'absolute';
        ls.right = `${options.paddingRight}px`;
        ls.top = `${options.paddingTop}px`;

        const legendRoot = this.legend.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
:host {
    background: var(--background-overlay, white);
    border: 1px solid hsl(0, 0%, 80%);
    border-radius: 3px;
    padding: 5px 10px;
}
.item {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    user-select: none;
}
.item:not(.visible) {
    color: gray;
    text-decoration: line-through;
}
.item .example {
    width: 50px;
    margin-right: 10px;
    max-height: 1em;
}`;
        legendRoot.appendChild(style);

        this.itemContainer = legendRoot;
        this.update();

        const shadowRoot = el.shadowRoot!
        shadowRoot.appendChild(this.legend);
        model.updated.on(() => this.update());

        model.disposing.on(() => {
            shadowRoot.removeChild(this.legend);
        })
    }

    update() {
        this.legend.style.display = this.options.legend ? "" : "none";
        if (!this.options.legend)
            return;

        for (const s of this.options.series) {
            if (!this.items.has(s)) {
                const item = document.createElement('div');
                item.className = 'item';
                const example = document.createElement('div');
                example.className = 'example';
                item.appendChild(example);
                const name = document.createElement('label');
                name.textContent = s.name;
                item.appendChild(name);
                this.itemContainer.appendChild(item);

                item.addEventListener('click', (ev) => {
                    s.visible = !s.visible;
                    this.model.update();
                })

                this.items.set(s, {item, example});
            }
            const item = this.items.get(s)!;
            item.item.classList.toggle('visible', s.visible);
            item.example.style.height = `${s.lineWidth ?? this.options.lineWidth}px`;
            item.example.style.backgroundColor = s.color.toString();
        }
    }
}

export const legend: TimeChartPlugin<Legend> = {
    apply(chart) {
        return new Legend(chart.el, chart.model, chart.options);
    }
}
