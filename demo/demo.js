main();

function main() {
    const canvas = document.getElementById('chart');
    const scale = window.devicePixelRatio;
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    }

    const chart = new timeChart.TimeChart(gl);

    const data = [];
    chart.renderModel.series.push({ name: 'random', data });
    let x = 0;
    function update() {
        const end = x + 1;
        for (; x < end; x += 0.1) {
            const y = Math.random() * 500 + 100;
            // const y = Math.sin(x * 0.02) * 300 + 320;
            data.push({ x, y });
        }
        chart.update();

        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
    // update()

    console.log(gl.getError());
}
