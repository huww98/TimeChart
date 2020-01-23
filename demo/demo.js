main();

function main() {
    const el = document.getElementById('chart');
    const chart = new TimeChart(el);

    const data = [];
    chart.addDataSeries(data);
    let x = 0;
    function update() {
        const end = x + 1;
        for (; x < end; x += 0.1) {
            // const y = Math.random() * 500 + 100;
            const y = Math.sin(x * 0.02) * 300 + 320;
            data.push({ x, y });
        }
        chart.update();

        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
    // update()
}
