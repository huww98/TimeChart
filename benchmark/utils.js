function f(x) {
    return Math.random() - 0.5 + Math.sin(x * 0.00002) * 40 + Math.sin(x * 0.001) * 5 + Math.sin(x * 0.1) * 2;
}

function getData(max) {
    const data = [];
    for (let x = 0; x < max; x++) {
        data.push({ x: x * 1000, y: f(x) });
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

function simulateInteraction(startXRange, endXRange, frames, cb) {
    let lastTime = 0;
    let currentXRange = startXRange;
    let warmUpFrames = 30;
    const factor = (endXRange / startXRange) ** (1 / frames);
    const pref = {
        xRange: [],
        time: [],
    }
    function nextFrame(time) {
        if (warmUpFrames > 0) {
            warmUpFrames--;
            currentXRange *= factor;
            cb(currentXRange);
            requestAnimationFrame(nextFrame);
        } else if (warmUpFrames == 0) {
            warmUpFrames--;
            lastTime = time;
            currentXRange = startXRange
            cb(currentXRange);
            console.time('interaction');
            requestAnimationFrame(nextFrame);
        } else if (frames > 0) {
            frames--;
            currentXRange *= factor;
            cb(currentXRange);
            pref.time.push(time - lastTime);
            pref.xRange.push(currentXRange);
            lastTime = time;
            requestAnimationFrame(nextFrame);
        } else {
            console.timeEnd('interaction');
            console.log(JSON.stringify(pref));
        }
    }

    setTimeout(() => {
        requestAnimationFrame(nextFrame)
    }, 2000);
}
