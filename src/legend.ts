import { ResolvedRenderOptions } from "./options";

export class Legend {
    legend: HTMLElement;
    constructor(private el: HTMLElement, private options: ResolvedRenderOptions) {
        el.style.position = 'relative'
        this.legend = document.createElement('chart-legend');
        const ls = this.legend.style;
        ls.position = 'absolute';
        ls.right = `${options.paddingRight}px`;
        ls.top = `${options.paddingTop}px`;

        const legendRoot = this.legend.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
        .timechart-legend.border {
            background: white;
            border: 1px solid hsl(0, 0%, 80%);
            border-radius: 3px;
            padding: 5px 10px;
        }
        .timechart-legend .item {
            display: flex;
            flex-flow: row nowrap;
            align-items: center;
        }
        .timechart-legend .item .example {
            width: 50px;
            margin-right: 10px;
            max-height: 1em;
        }`;
        legendRoot.appendChild(style);

        const border = document.createElement('div');
        border.className = 'timechart-legend border';

        for (const s of options.series) {
            const item = document.createElement('div');
            item.className = 'item';
            const example = document.createElement('div');
            example.className = 'example';
            example.style.height = `${s.lineWidth ?? options.lineWidth}px`;
            example.style.backgroundColor = s.color.toString();
            item.appendChild(example);
            const name = document.createElement('label');
            name.textContent = s.name;
            item.appendChild(name);
            border.appendChild(item);
        }
        legendRoot.appendChild(border);
        el.appendChild(this.legend);
    }

    update() {

    }
}
