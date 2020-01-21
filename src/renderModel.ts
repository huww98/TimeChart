class Axis {
    public min = 0;
    public max = 1;
}

interface DataPoint {
    x: number;
    y: number;
}

export class RenderModel {
    public xAxis = new Axis();
    public yAxis = new Axis();
    public dataPoints = [] as DataPoint[];
}
