main();

let stopped = false;

function main() {
    const el = document.getElementById('chart');
    const data = [];
    const chart = new TimeChart(el, {
        baseTime: Date.now() - performance.now(),
        series: [{ data }],
        xRange: { min: 0, max: 20*1000 },
        realTime: true,
    });

    let x = performance.now();
    function update(time) {
        for (; x < time; x += 1) {
            // const y = Math.random() * 500 + 100;
            const y = Math.sin(x * 0.002) * 300 + 320;
            data.push({ x, y });
        }
        chart.update();

        if (!stopped)
            requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

document.getElementById('stop-btn').addEventListener('click', function () {
    stopped = true
})
