main();

let stopped = false;

function main() {
    const el = document.getElementById('chart');
    const chart = new TimeChart(el, {
        baseTime: Date.now() - performance.now(),
    });

    const data = [];
    chart.addDataSeries(data);
    let x = performance.now();
    function update(time) {
        for (; x < time; x += 1) {
            // const y = Math.random() * 500 + 100;
            const y = Math.sin(x * 0.02) * 300 + 320;
            data.push({ x, y });
        }
        chart.update();

        if (!stopped)
            requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
    // update()
}

document.getElementById('stop-btn').addEventListener('click', function () {
    stopped = true
})
