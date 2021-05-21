main();

function main() {
    const el = document.getElementById('chart');
    const dataSin = [];
    const dataCos = [];
    const chart = new TimeChart(el, {
        // debugWebGL: true,
        // forceWebGL1: true,
        baseTime: Date.now() - performance.now(),
        series: [
            {
                name: 'Sin',
                data: dataSin,
            },
            {
                name: 'Cos',
                data: dataCos,
                lineWidth: 2,
                color: 'red',
            },
        ],
        xRange: { min: 0, max: 20 * 1000 },
        realTime: true,
        zoom: {
            x: {
                autoRange: true,
                minDomainExtent: 50,
            },
            y: {
                autoRange: true,
                minDomainExtent: 1,
            }
        },
        tooltip: true,
    });
    const pointCountEl = document.getElementById('point-count');

    let x = performance.now() - 20*1000;
    function update() {
        const time = performance.now();
        for (; x < time; x += 1) {
            // const y = Math.random() * 500 + 100;
            const y_sin = Math.sin(x * 0.002) * 320;
            dataSin.push({ x, y: y_sin });

            const y_cos = Math.cos(x * 0.002) * 200;
            dataCos.push({ x, y: y_cos });
        }
        pointCountEl.innerText = dataSin.length;
        chart.update();
    }

    const ev = setInterval(update, 5);
    document.getElementById('stop-btn').addEventListener('click', function () {
        clearInterval(ev);
    });
    document.getElementById('follow-btn').addEventListener('click', function () {
        chart.options.realTime = true;
    });
    document.getElementById('tooltip-btn').addEventListener('click', function () {
        chart.options.tooltip = !chart.options.tooltip;
    });
}
