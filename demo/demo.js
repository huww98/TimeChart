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

    function update() {
        chart.renderModel.dataPoints.length = 0;
        for (let x = 0; x < 960; x += 0.01) {
            const y = Math.random() * 500 + 100;
            chart.renderModel.dataPoints.push({ x, y });
        }
        chart.update();

        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
    // update()

    console.log(gl.getError());
}
