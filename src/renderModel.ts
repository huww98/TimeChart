class Axis {
    public min = 0;
    public max = 1;
}

export interface DataSeries {
    name: string;
    data: DataPoint[];
}

export interface DataPoint {
    x: number;
    y: number;
}

export class RenderModel {
    public xAxis = new Axis();
    public yAxis = new Axis();
    public series = [] as DataSeries[];
}
