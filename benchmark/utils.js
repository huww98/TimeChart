function f(x) {
    return Math.random() - 0.5 + Math.sin(x * 0.00002) * 40 + Math.sin(x * 0.001) * 5 + Math.sin(x * 0.1) * 2;
}

function getData(max) {
    const data = [];
    for (let x = 0; x < max; x++) {
        data.push({x: x * 1000, y: f(x)});
    }
    return data;
}

function getUPlotData(max) {
    const data = [[], []];
    for (let x = 0; x < max; x++) {
        data[0].push(x);
        data[1].push(f(x));
    }
    return data;
}
