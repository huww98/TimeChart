import { ResolvedOptions, dirOptions } from "./options";

export class ChartZoomBoundary {
    constructor(private options: ResolvedOptions) {
    }

    enforceBondary() {
        for (const { op } of dirOptions(this.options)) {
            const domain = op.scale.domain();
            const inExtent = domain[1] - domain[0];
            const extent = Math.min(op.maxDomainExtent, Math.max(op.minDomainExtent, inExtent));
            const deltaE = (extent - inExtent) / 2;
            domain[0] -= deltaE;
            domain[1] += deltaE;
            const deltaO = Math.min(Math.max(op.minDomain - domain[0], 0), op.maxDomain - domain[1]);

            domain[0] += deltaO;
            domain[1] += deltaO;
            op.scale.domain(domain);
        }
    }
}
