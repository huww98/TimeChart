// import { vec3, vec2, mat4 } from "gl-matrix";

main();

function main() {
    const canvas = document.getElementById('chart');
    const scale = window.devicePixelRatio;
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    const gl = canvas.getContext('webgl');

    // If we don't have a GL context, give up now
    if (!gl) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }

    // Vertex shader program
    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec2 aNorm;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform float uLineWidth;

        void main() {
            vec4 offset = uLineWidth * vec4(aNorm, 0.0, 0.0);
            gl_Position = uProjectionMatrix * (uModelViewMatrix * aVertexPosition + offset);
        }
    `;

    // Fragment shader program
    const fsSource = `
        void main() {
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
    `;

    // Initialize a shader program; this is where all the lighting
    // for the vertices and so forth is established.
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    // Collect all the info needed to use the shader program.
    // Look up which attribute our shader program is using
    // for aVertexPosition and look up uniform locations.
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            norm: gl.getAttribLocation(shaderProgram, 'aNorm'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            lineWidth: gl.getUniformLocation(shaderProgram, 'uLineWidth'),
        },
    };

    // Here's where we call the routine that builds all the
    // objects we'll be drawing.
    const buffers = initBuffers(gl);

    // Draw the scene
    drawScene(gl, programInfo, buffers);
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple two-dimensional square.
//
function initBuffers(gl) {

    // Create a buffer for the square's positions.

    const positionBuffer = gl.createBuffer();
    const normBuffer = gl.createBuffer();

    // Now create an array of positions for the square.

    const points = [];

    for (let x = 0; x < 960; x += 0.01) {
        const y = Math.sin(x * 0.1) * 200 + 300
        points.push([x, y])
    }

    const positions = [];
    const norms = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const dir = vec2.create()
        vec2.sub(dir, p1, p0)
        vec2.normalize(dir, dir)
        const norm = vec2.fromValues(dir[1], -dir[0])
        const nevagiveNorm = vec2.create()
        vec2.negate(nevagiveNorm, norm)
        positions.push(...p0)
        positions.push(...p0)
        positions.push(...p1)
        positions.push(...p1)
        norms.push(...norm)
        norms.push(...nevagiveNorm)
        norms.push(...norm)
        norms.push(...nevagiveNorm)
    }

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Now pass the list of positions into WebGL to build the
    // shape. We do this by creating a Float32Array from the
    // JavaScript array, then use it to fill the current buffer.

    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norms), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        norm: normBuffer,
    };
}

//
// Draw the scene.
//
function drawScene(gl, programInfo, buffers) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT);

    const scale = vec2.fromValues(960.0, 640.0)
    vec2.divide(scale, scale, [2, 2])
    vec2.inverse(scale, scale)

    const translate = mat4.create();
    mat4.fromTranslation(translate, [-1.0, -1.0, 0.0])

    const projectionMatrix = mat4.create();
    mat4.fromScaling(projectionMatrix, [...scale, 1.0]);
    mat4.multiply(projectionMatrix, translate, projectionMatrix)


    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    const modelViewMatrix = mat4.create();

    // Now move the drawing position a bit to where we want to
    // start drawing the square.

    // mat4.translate(modelViewMatrix,     // destination matrix
    //     modelViewMatrix,     // matrix to translate
    //     [-0.0, 0.0, -6.0]);  // amount to translate

    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.
    {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.norm);
        gl.vertexAttribPointer(
            programInfo.attribLocations.norm,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.norm);
    }

    // Tell WebGL to use our program when drawing

    gl.useProgram(programInfo.program);

    // Set the shader uniforms

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);
    gl.uniform1f(
        programInfo.uniformLocations.lineWidth,
        1.0,
    )

    {
        const offset = 0;
        const vertexCount = 383996;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }

    console.log(gl.getError());
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    // Send the source to the shader object

    gl.shaderSource(shader, source);

    // Compile the shader program

    gl.compileShader(shader);

    // See if it compiled successfully

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}
