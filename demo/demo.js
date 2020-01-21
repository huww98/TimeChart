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
    console.log(gl.getError());
}
